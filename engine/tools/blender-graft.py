# Blender headless: пересадка донорского узла (кабины) на нашу процедурную машину.
# Донор приезжает в своих единицах и своей ориентации — скрипт разворачивает его,
# масштабирует по ЗАДАННОЙ ШИРИНЕ и сажает носом и низом в нужные координаты.
#
#   blender -b --python blender-graft.py -- --base base.glb --add cab.glb --out mix.glb \
#           [--rotz 90] [--width 2.48] [--front 4.29] [--bottom 0]
# Оси после импорта glTF: Blender Z-up, наша длина = X, ширина = Y, высота = Z.
import bpy, sys, math, mathutils

a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def opt(n, d=None):
    return a[a.index(n) + 1] if n in a else d
fbase, fadd, fout = opt("--base"), opt("--add"), opt("--out")
rotz   = math.radians(float(opt("--rotz", "90")))
width  = float(opt("--width", "2.48"))
front  = float(opt("--front", "4.29"))
bottom = float(opt("--bottom", "0"))

def bbox(objs):
    lo = mathutils.Vector((1e18,) * 3); hi = mathutils.Vector((-1e18,) * 3)
    for ob in objs:
        if ob.type != "MESH":
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ mathutils.Vector(c)
            lo = mathutils.Vector((min(lo[i], w[i]) for i in range(3)))
            hi = mathutils.Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi

bpy.ops.wm.read_factory_settings(use_empty=True)

if fbase:                                   # без --base просто размещаем донора
    bpy.ops.import_scene.gltf(filepath=fbase)
    base_objs = list(bpy.context.scene.objects)
    lo, hi = bbox(base_objs)
    print("база: X[%.2f..%.2f] Y[%.2f..%.2f] Z[%.2f..%.2f]" % (lo.x, hi.x, lo.y, hi.y, lo.z, hi.z))

before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=fadd)
add_objs = [o for o in bpy.context.scene.objects if o not in before]
add_roots = [o for o in add_objs if o.parent not in add_objs]

# 1) развернуть донора носом по +X
piv = bpy.data.objects.new("graft_pivot", None)
bpy.context.collection.objects.link(piv)
for o in add_roots:
    o.parent = piv
    o.matrix_parent_inverse = piv.matrix_world.inverted()
piv.rotation_euler = (0, 0, rotz)
bpy.context.view_layer.update()

# 2) масштаб: по ширине (Y) либо по высоте (Z, --height) — смотря какой размер
# у донора надёжнее. Длина у доноров гуляет из-за того, что попало в срез.
lo2, hi2 = bbox(add_objs)
height, length = opt("--height"), opt("--length")
if length:                                   # по длине — когда пересаживаем всё шасси
    k = float(length) / max(hi2.x - lo2.x, 1e-9)
elif height:
    k = float(height) / max(hi2.z - lo2.z, 1e-9)
else:
    k = width / max(hi2.y - lo2.y, 1e-9)
piv.scale = (k, k, k)
bpy.context.view_layer.update()

# 3) посадить: нос в --front, низ в --bottom, по центру по ширине
lo3, hi3 = bbox(add_objs)
piv.location = (piv.location.x + (front - hi3.x),
                piv.location.y - (lo3.y + hi3.y) / 2,
                piv.location.z + (bottom - lo3.z))
bpy.context.view_layer.update()
lo4, hi4 = bbox(add_objs)
print("донор: k=%.4f  X[%.2f..%.2f] Y[%.2f..%.2f] Z[%.2f..%.2f]  (длина %.2f, высота %.2f)"
      % (k, lo4.x, hi4.x, lo4.y, hi4.y, lo4.z, hi4.z, hi4.x - lo4.x, hi4.z - lo4.z))

# 3b) заглушка задней стенки: донорскую кабину со спальником режут поперёк,
# и она остаётся открытой сзади — закрываем её пластиной по габариту среза
if opt("--capback") is not None:
    inset = float(opt("--capback", "0.02"))
    zbot = float(opt("--capbottom", "1.30"))       # только кузов кабины, не до земли
    bpy.ops.mesh.primitive_cube_add(size=1, location=(lo4.x + inset,
                                                      (lo4.y + hi4.y) / 2,
                                                      (zbot + hi4.z) / 2))
    cap = bpy.context.object
    cap.name = "cab_backplate"
    cap.scale = (0.04, (hi4.y - lo4.y) * 0.78, (hi4.z - zbot) * 0.99)
    cm = bpy.data.materials.new("kabina")          # имя из нашей схемы: blender-pbr покрасит сам
    cm.use_nodes = True
    cap.data.materials.append(cm)
    print("заглушка задней стенки: x=%.2f  %.2f×%.2f" % (lo4.x + inset, cap.scale.y, cap.scale.z))

# 4) перекрасить кузовные материалы донора в наш цвет.
# Донор приезжает в своей ливрее (у КамАЗа-5460 жёлтая) — ищем жёлто-оранжевое
# семейство по пропорциям каналов, остальное (хром, стекло, резина) не трогаем.
paint = opt("--paint")
if paint:
    def srgb(h):
        def c(v):
            v = v / 255.0
            return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        return (c(int(h[0:2], 16)), c(int(h[2:4], 16)), c(int(h[4:6], 16)), 1.0)
    body = srgb(paint)
    donor_mats = {ms.material for o in add_objs if o.type == "MESH" for ms in o.material_slots if ms.material}
    painted = []
    for m in donor_mats:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m.use_nodes else None
        if not b:
            continue
        if "glass" in m.name.lower():
            b.inputs["Base Color"].default_value = (0.72, 0.80, 0.84, 1.0)
            b.inputs["Roughness"].default_value = 0.05
            if "Transmission Weight" in b.inputs:
                b.inputs["Transmission Weight"].default_value = 0.90
            if "IOR" in b.inputs:
                b.inputs["IOR"].default_value = 1.52
            continue
        r, g, bl, _ = b.inputs["Base Color"].default_value
        if r > 0.30 and g <= 0.90 * r and bl <= 0.30 * r:                  # красно-жёлтая ливрея
            b.inputs["Base Color"].default_value = body
            b.inputs["Roughness"].default_value = 0.26
            if "Coat Weight" in b.inputs:
                b.inputs["Coat Weight"].default_value = 0.35
                b.inputs["Coat Roughness"].default_value = 0.06
            painted.append(m.name)
    print("перекрашено:", len(painted), "из", len(donor_mats), "->", ", ".join(sorted(painted)[:8]))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=fout, export_format="GLB", export_yup=True)
print("готово ->", fout)
