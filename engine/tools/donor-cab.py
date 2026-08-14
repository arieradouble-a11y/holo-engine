# Вырезать кабину из донорского шасси и прорядить её до вменяемого веса.
# Донор: КамАЗ-55111 (Sketchfab, CC-BY, mamontnikita62) — 3.55 млн треугольников,
# нос у X-min. Кабина живёт в первых ~28% длины (материалы Kabina/SALON/steklo/fara).
#
#   blender -b --factory-startup -P donor-cab.py -- --in donor.glb --out cab.glb \
#           [--xmax 0.285] [--tris 120000] [--drop shini,Disk1]
#
# Колесо и диск выбрасываются ПО МАТЕРИАЛУ, а не коробкой: коробка неизбежно
# срезала бы низ кабины вместе с аркой (шина заходит выше низа кабины).
import bpy, bmesh, sys, mathutils

a = sys.argv[sys.argv.index('--') + 1:]
def opt(n, d=None): return a[a.index(n) + 1] if n in a else d
SRC, OUT = opt('--in'), opt('--out')
XMIN, XMAX = float(opt('--xmin', '0')), float(opt('--xmax', '0.285'))
TRIS = int(opt('--tris', '120000'))
DROP = set(opt('--drop', 'shini,Disk1').split(','))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print('импортировано мешей:', len(meshes))

# 1) выкинуть объекты, у которых ВСЕ материалы в чёрном списке (колёса — самые тяжёлые)
kept = []
for ob in meshes:
    names = [m.name for m in ob.data.materials if m]
    if names and all(n in DROP for n in names):
        bpy.data.objects.remove(ob, do_unlink=True)
    else:
        kept.append(ob)
print('после отсева колёс:', len(kept))

# 2) склеить остаток в один меш
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = kept[0]
for ob in kept: ob.select_set(True)
if len(kept) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 3) общий bbox — доли считаем по нему (как в extract-zone.py)
cs = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
mnx, mxx = min(c.x for c in cs), max(c.x for c in cs)
lx = mxx - mnx
print('BBOX X %.1f..%.1f' % (mnx, mxx))

names = [m.name if m else '' for m in obj.data.materials]
me = obj.data
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()
todel = []
for f in bm.faces:
    fx = (f.calc_center_median().x - mnx) / lx if lx else 0.5
    n = names[f.material_index] if f.material_index < len(names) else ''
    if not (XMIN <= fx <= XMAX) or n in DROP:
        todel.append(f)
bmesh.ops.delete(bm, geom=todel, context='FACES')
bm.to_mesh(me); bm.free()
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True); bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.delete_loose(); bpy.ops.object.mode_set(mode='OBJECT')

tris = sum(len(p.vertices) - 2 for p in me.polygons)
print('после реза треугольников:', tris)

# 4) прореживание до целевого веса (collapse держит силуэт лучше, чем planar)
if tris > TRIS:
    d = obj.modifiers.new('Decimate', 'DECIMATE')
    d.decimate_type = 'COLLAPSE'
    d.ratio = TRIS / tris
    bpy.ops.object.modifier_apply(modifier=d.name)
    print('после прореживания:', sum(len(p.vertices) - 2 for p in obj.data.polygons))

cs = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
lo = [min(c[i] for c in cs) for i in range(3)]
hi = [max(c[i] for c in cs) for i in range(3)]
print('CAB BBOX X[%.1f..%.1f] Y[%.1f..%.1f] Z[%.1f..%.1f]' % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
print('CAB SIZE X=%.1f Y=%.1f Z=%.1f' % (hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]))
used = sorted({names[p.material_index] for p in obj.data.polygons if p.material_index < len(names)})
print('CAB MATS ' + ','.join(used))

bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
                          export_materials='EXPORT', export_apply=True)
print('WROTE', OUT)
