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

argv = sys.argv[sys.argv.index("--")+1:]
def arg(k, d=None):
    return argv[argv.index(k)+1] if k in argv else d

src   = arg("--in"); dst = arg("--out")
weld  = float(arg("--weld", "0.0002"))
sm    = int(arg("--smooth", "2"))
ang   = math.radians(float(arg("--angle", "4")))
zones = json.loads(arg("--zones", "[]"))

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
if sm > 0:
    bpy.ops.mesh.vertices_smooth(factor=0.5, repeat=sm)
bpy.ops.mesh.dissolve_limited(angle_limit=ang)
bpy.ops.object.mode_set(mode='OBJECT')
print("OUT faces (facets):", len(obj.data.polygons))

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
