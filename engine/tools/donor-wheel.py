# Вырезать ОДНО колесо из донорского шасси и нормализовать его для тиражирования.
# Донор: КамАЗ-55111 (Sketchfab, CC-BY, mamontnikita62). Колёса там — самая тяжёлая
# часть (shini ~1.96 млн треугольников, Disk1 ~214 тыс.), поэтому берём одно колесо
# и прореживаем; дальше blender-ilosos.py ставит его копии во все позиции.
#
#   blender -b --factory-startup -P donor-wheel.py -- --in donor.glb --out wheel.glb \
#           [--xmin 0.10] [--xmax 0.28] [--tris 40000]
#
# На выходе: колесо в НАЧАЛЕ КООРДИНАТ, ось вдоль Y, диаметр РОВНО 1.0.
# Так его можно ставить куда угодно простым scale=диаметр + translate.
import bpy, bmesh, sys, mathutils

a = sys.argv[sys.argv.index('--') + 1:]
def opt(n, d=None): return a[a.index(n) + 1] if n in a else d
SRC, OUT = opt('--in'), opt('--out')
XMIN, XMAX = float(opt('--xmin', '0.10')), float(opt('--xmax', '0.28'))
TRIS = int(opt('--tris', '40000'))
KEEP = set(opt('--keep', 'shini,Disk1').split(','))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

# оставить только объекты, где есть нужные материалы (резина + диск)
kept = []
for ob in meshes:
    names = [m.name for m in ob.data.materials if m]
    if names and any(n in KEEP for n in names):
        kept.append(ob)
    else:
        bpy.data.objects.remove(ob, do_unlink=True)
print('объектов с колёсной резиной/диском:', len(kept))

bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = kept[0]
for ob in kept: ob.select_set(True)
if len(kept) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
# glTF-импорт вешает объекты на корневой узел с поворотом Y-up→Z-up, а
# transform_apply родительский трансформ НЕ запекает. Без parent_clear все
# v.co/calc_center_median остаются в ЧУЖИХ осях (ось колеса вдоль Z, а не Y),
# и любой отбор по «ширине» режет шину поперёк.
if obj.parent:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Габарит считаем ПО ВЕРШИНАМ: obj.bound_box после join/transform_apply остаётся
# устаревшим, и доли по нему уезжают так, что зона оказывается пустой.
vs = [v.co for v in obj.data.vertices]
mnx, mxx = min(v.x for v in vs), max(v.x for v in vs)
lx = mxx - mnx
print('BBOX всех колёс по вершинам X %.1f..%.1f' % (mnx, mxx))

names = [m.name if m else '' for m in obj.data.materials]
me = obj.data
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()

# 1) зона по длине — только переднее колесо (у 6×4 между ним и тележкой явный разрыв)
front = []
for f in bm.faces:
    n = names[f.material_index] if f.material_index < len(names) else ''
    if n not in KEEP: continue
    fx = (f.calc_center_median().x - mnx) / lx if lx else 0.5
    if XMIN <= fx <= XMAX: front.append(f)
print('граней в зоне переднего колеса:', len(front))
# 2) сторону выбираем по МЕДИАНЕ уже внутри зоны, а не по общему габариту:
#    глобальный центр по ширине сюда не годится, колёса стоят парой
ys = sorted(f.calc_center_median().y for f in front)
ymid = ys[len(ys) // 2] if ys else 0
keep = set(f for f in front if f.calc_center_median().y >= ymid)
print('оставляем одну сторону, граней:', len(keep))
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context='FACES')
# ВАЖНО: delete по граням оставляет висячие вершины второго колеса. Габарит потом
# считается по вершинам, и без этой чистки нормализация уезжает в разы.
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(me); bm.free()
tris = sum(len(p.vertices) - 2 for p in me.polygons)
print('одно колесо, треугольников:', tris)
if not tris:
    raise SystemExit('зона пустая — проверь --xmin/--xmax')

if tris > TRIS:
    d = obj.modifiers.new('Dec', 'DECIMATE')
    d.decimate_type = 'COLLAPSE'; d.ratio = TRIS / tris
    bpy.ops.object.modifier_apply(modifier=d.name)
    print('после прореживания:', sum(len(p.vertices) - 2 for p in obj.data.polygons))

# нормализация: центр в ноль, диаметр 1.0. Диаметр меряем по ПЛОСКОСТИ ВРАЩЕНИЯ
# (X и Z), а не по bbox целиком — по Y идёт ширина шины, она меньше и сбила бы масштаб.
vs = [v.co for v in obj.data.vertices]
lo = [min(v[i] for v in vs) for i in range(3)]
hi = [max(v[i] for v in vs) for i in range(3)]
ctr = [(lo[i] + hi[i]) / 2 for i in range(3)]
dia = max(hi[0] - lo[0], hi[2] - lo[2])
k = 1.0 / dia
obj.matrix_world = (mathutils.Matrix.Diagonal((k, k, k, 1.0))
                    @ mathutils.Matrix.Translation((-ctr[0], -ctr[1], -ctr[2])))
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
vs = [v.co for v in obj.data.vertices]
lo = [min(v[i] for v in vs) for i in range(3)]
hi = [max(v[i] for v in vs) for i in range(3)]
print('WHEEL нормализовано: диаметр %.3f, ширина по Y %.3f' % (max(hi[0]-lo[0], hi[2]-lo[2]), hi[1]-lo[1]))

obj.data.materials.clear()          # красит сцена, чужие материалы не нужны
for f in obj.data.polygons: f.use_smooth = True
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
                          export_materials='NONE', export_apply=True)
print('WROTE', OUT)
