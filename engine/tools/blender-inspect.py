# Blender headless: оси/габариты GLB-скана + профиль высоты вдоль длинной оси,
# чтобы назначить зоны частей (кабина/кузов/колёса). Blender после импорта
# glTF живёт в Z-up (glTF Y-up конвертируется), поэтому вверх = Z.
# Запуск: blender --background --python blender-inspect.py -- <файл.glb>
import bpy, sys
import mathutils

argv = sys.argv[sys.argv.index("--")+1:]
path = argv[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print("MESHES:", [(o.name, len(o.data.polygons)) for o in meshes])

mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
for o in meshes:
    for v in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(v)
        mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
size = mx - mn
print("BBOX min", tuple(round(x,3) for x in mn), "max", tuple(round(x,3) for x in mx))
print("SIZE xyz", tuple(round(x,3) for x in size), "| up=Z (blender)")

o = meshes[0]
axis = 0 if size.x >= size.y else 1   # длинная горизонтальная ось (Z — вверх)
print("LONG AXIS:", "X" if axis == 0 else "Y")
mw = o.matrix_world
nb = 12
hsum = [0.0]*nb; hmax = [0.0]*nb; cnt = [0]*nb
for p in o.data.polygons:
    c = mw @ p.center
    t = (c[axis]-mn[axis]) / max(1e-6, size[axis])
    b = min(nb-1, max(0, int(t*nb)))
    z = (c.z - mn.z) / max(1e-6, size.z)   # относительная высота 0..1
    hsum[b] += z; cnt[b] += 1
    if z > hmax[b]: hmax[b] = z
print("AVG HEIGHT per bin:", [round(hsum[i]/max(1,cnt[i]),2) for i in range(nb)])
print("MAX HEIGHT per bin:", [round(h,2) for h in hmax])
print("FACE COUNT per bin:", cnt)
