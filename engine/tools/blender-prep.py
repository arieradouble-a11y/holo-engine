# Blender headless: подготовка TRELLIS-скана к «CAD-виду» + авто-разборка на системы.
#
#   blender --background --python blender-prep.py -- \
#       --in ../musorovoz.glb --out ../musorovoz-parts.glb \
#       --weld 0.0002 --smooth 2 --angle 4 \
#       --zones '[{"name":"hodovaya","zmax":0.22},{"name":"kabina","tmax":0.28},{"name":"bunker","tmin":0.82},{"name":"kuzov"}]'
#
# Пайплайн: weld (real adjacency) → vertex smooth (иначе dissolve не видит
# копланарность на шуме) → dissolve_limited (planar-децимация: копланарные
# треугольники схлопываются в фасеты — рёбра между фасетами становятся чёткими,
# как у авторской CAD-модели; glTF-экспорт триангулирует фасеты обратно, но
# fan-рёбра внутри фасета копланарны и EdgesGeometry их не рисует) →
# материалы по зонам центроидов фейсов (t = доля вдоль длинной горизонтальной
# оси, z = доля высоты; Blender после импорта glTF живёт в Z-up).
# Первая подходящая зона выигрывает; зона без условий = default.
# Движок дальше сам делит на системы через CONFIG.matRules по именам материалов.
import bpy, sys, json, math
import mathutils
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--")+1:]
def arg(k, d=None):
    return argv[argv.index(k)+1] if k in argv else d

src   = arg("--in"); dst = arg("--out")
weld  = float(arg("--weld", "0.0002"))
sm    = int(arg("--smooth", "2"))
ang   = math.radians(float(arg("--angle", "4")))
zones = json.loads(arg("--zones", "[]"))
strip = int(arg("--strip-interior", "0"))   # число направлений видимости (0 = выкл, 14 — норм)
mincomp = int(arg("--min-component", "0"))  # удалить связные «хлопья» меньше N фейсов (0 = выкл)
corr  = int(arg("--corrective", "0"))       # Corrective Smooth итераций (сохраняет рёбра; заменяет vertex-smooth)
decim = float(arg("--decimate", "0"))       # quadric-децимация, доля фейсов 0..1 (0 = выкл)
vox   = float(arg("--voxel", "0"))          # voxel remesh, размер вокселя в долях макс. габарита (0 = выкл; ~0.004)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
print("IN  faces:", len(obj.data.polygons))

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=weld)
bpy.ops.object.mode_set(mode='OBJECT')
# Voxel remesh (OpenVDB): переливка в водонепроницаемую оболочку по объёму —
# радикально убирает шум и весь внутренний мусор, но ест мелкую деталь
# (крайняя мера; тонкие элементы тоньше ~2 вокселей исчезают/сливаются).
if vox > 0:
    obj.data.remesh_voxel_size = max(obj.dimensions) * vox
    bpy.ops.object.voxel_remesh()
    print("VOXEL remesh @", round(vox,5), "->", len(obj.data.polygons), "faces")
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
if corr == 0 and sm > 0:
    bpy.ops.mesh.vertices_smooth(factor=0.5, repeat=sm)
bpy.ops.object.mode_set(mode='OBJECT')
# Corrective Smooth: разглаживает шум скана, но подтягивает вершины к исходной
# форме — рёбра и объём сохраняются лучше, чем у наивного Лапласиана.
if corr > 0:
    m = obj.modifiers.new("corr", 'CORRECTIVE_SMOOTH')
    m.iterations = corr; m.factor = 0.5
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.dissolve_limited(angle_limit=ang)
bpy.ops.object.mode_set(mode='OBJECT')
print("OUT faces (facets):", len(obj.data.polygons))

# ---- вырезание внутреннего мусора скана (--strip-interior N) ----------------
# TRELLIS оставляет геометрию ВНУТРИ оболочки (полости, обрывки) — во вьювере
# она читается как шумный «клубок» линий. Фейс считается видимым, если хотя бы
# один луч из его центра (наружу, по N глобальным направлениям + своей нормали)
# уходит в бесконечность, не задев меш. Невидимые ни с одного направления —
# внутренние, удаляются вместе с осиротевшими рёбрами/вершинами.
if strip > 0:
    import bmesh
    deps = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, deps)
    size = max(obj.dimensions)
    eps = size * 1.5e-3
    # квазиравномерные направления (спираль Фибоначчи по сфере)
    dirs = []
    ga = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(strip):
        y = 1.0 - 2.0 * (i + 0.5) / strip
        r = math.sqrt(max(0.0, 1.0 - y * y))
        dirs.append(mathutils.Vector((math.cos(ga * i) * r, y, math.sin(ga * i) * r)))
    mw = obj.matrix_world; mwi = mw.inverted()
    hidden = []
    for p in obj.data.polygons:
        n = p.normal
        origin = p.center + n * eps
        vis = False
        if bvh.ray_cast(origin, n)[0] is None:      # быстрый тест вдоль нормали
            vis = True
        else:
            for d in dirs:
                dl = (mwi.to_3x3() @ d).normalized() # мировое направление -> локальное
                if dl.dot(n) <= 0.1: continue        # только полусфера наружу
                if bvh.ray_cast(origin, dl)[0] is None: vis = True; break
        if not vis: hidden.append(p.index)
    if hidden:
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in hidden], context='FACES')
        bm.to_mesh(obj.data); bm.free()
    print("STRIPPED interior faces:", len(hidden), "-> left:", len(obj.data.polygons))

# ---- мелкие связные «хлопья» (--min-component N) -----------------------------
# Скан оставляет висящие обрывки из десятков-сотен треугольников (особенно после
# strip-interior). Компоненты связности меньше N фейсов — в мусор.
if mincomp > 0:
    import bmesh
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen = [False]*len(bm.faces)
    kill = []
    for f0 in bm.faces:
        if seen[f0.index]: continue
        comp = [f0]; seen[f0.index] = True; q = [f0]
        while q:
            f = q.pop()
            for e in f.edges:
                for nf in e.link_faces:
                    if not seen[nf.index]:
                        seen[nf.index] = True; comp.append(nf); q.append(nf)
        if len(comp) < mincomp: kill.extend(comp)
    if kill:
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(obj.data)
    bm.free()
    print("DROPPED small components:", len(kill), "faces -> left:", len(obj.data.polygons))

# ---- quadric-децимация (--decimate R) ---------------------------------------
# Схлопывание рёбер по метрике ошибки: плоские зоны дешевеют первыми, острые
# рёбра фасетов держатся дольше всего. Даёт −40..50% веса почти без потери вида.
if decim > 0:
    m = obj.modifiers.new("dec", 'DECIMATE')
    m.ratio = decim
    bpy.ops.object.modifier_apply(modifier=m.name)
    print("DECIMATED to", decim, "->", len(obj.data.polygons), "faces")

# ---- зоны -> материалы ------------------------------------------------------
if zones:
    mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
    for v in obj.bound_box:
        w = obj.matrix_world @ mathutils.Vector(v)
        mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
    size = mx - mn
    axis = 0 if size.x >= size.y else 1        # длинная горизонтальная ось (Z — вверх)
    obj.data.materials.clear()
    for z in zones:
        m = bpy.data.materials.new(name=z["name"])
        obj.data.materials.append(m)
    mw = obj.matrix_world
    stats = [0]*len(zones)
    for p in obj.data.polygons:
        c = mw @ p.center
        t = (c[axis]-mn[axis]) / max(1e-6, size[axis])
        h = (c.z - mn.z) / max(1e-6, size.z)
        for i, z in enumerate(zones):
            if t < z.get("tmin", -1) or t > z.get("tmax", 2): continue
            if h < z.get("zmin", -1) or h > z.get("zmax", 2): continue
            p.material_index = i; stats[i] += 1
            break
    print("ZONES:", {zones[i]["name"]: stats[i] for i in range(len(zones))})

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB')
print("SAVED:", dst)
