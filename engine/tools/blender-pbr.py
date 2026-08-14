# Blender headless: PBR-рендер илососа из GLB, собранного decl-to-glb.mjs.
# Материалы назначаются ПО ИМЕНИ (shassi/kabina/tank/...), студийный свет,
# Cycles на GPU с откатом на CPU.
#
#   blender -b --python blender-pbr.py -- --in ilosos.glb --out r.png \
#           [--az 37] [--el 13] [--dist 21] [--samples 96] [--res 1600x900]
import bpy, sys, math, mathutils

a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def opt(n, d=None):
    return a[a.index(n) + 1] if n in a else d
fin  = opt("--in"); fout = opt("--out")
az   = math.radians(float(opt("--az", "37")))
el   = math.radians(float(opt("--el", "13")))
dist = float(opt("--dist", "21"))
samples = int(opt("--samples", "96"))
resw, resh = (int(v) for v in opt("--res", "1600x900").split("x"))

def srgb(h):                                    # HEX → linear (Blender base color)
    def c(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(int(h[0:2], 16)), c(int(h[2:4], 16)), c(int(h[4:6], 16)), 1.0)

# имя материала → (цвет, metallic, roughness, спец)
MATS = {
    "kabina": ("E85A0C", 0.00, 0.26, "coat"),        # оранжевая эмаль спецтехники
    "tank":   ("E85A0C", 0.00, 0.32, "coat"),
    "hatch":  ("D9540B", 0.00, 0.34, "coat"),
    "shassi": ("34383D", 0.80, 0.46, None),          # рама, мосты — тёмный металл
    "fwing":  ("34383D", 0.80, 0.46, None),          # переднее крыло (снимается при пересадке)
    "ftyre":  ("131416", 0.00, 0.88, None),          # переднее колесо (снимается)
    "frim":   ("B6BBC0", 0.85, 0.34, None),
    "tyre":   ("131416", 0.00, 0.88, None),          # резина
    "rim":    ("B6BBC0", 0.85, 0.34, None),          # диск
    "pump":   ("9CA2A8", 0.90, 0.30, None),          # насос — голый металл
    "hydro":  ("22262A", 0.65, 0.42, None),          # гидравлика
    "boom":   ("6E7A73", 0.72, 0.38, None),          # стрела
    "hose":   ("17181A", 0.00, 0.80, None),          # рукав, РВД
    "glass":  ("C8DCE4", 0.00, 0.05, "glass"),
    # суффиксные материалы: имя вида «kabina-dark» — в голограмме подстрока
    # «kabina» отправляет деталь в свою систему, здесь работает суффикс
    "dark":   ("1B1D20", 0.20, 0.42, None),          # зеркала, юбка бампера, притворы
    "lamp":   ("EDF2F5", 0.00, 0.08, "lamp"),        # фары, прожекторы
    "amber":  ("FF8A0A", 0.00, 0.16, "amber"),       # маячки, повторители
}

def mat_key(name):
    base = name.split(".")[0]                        # gltf может дописать .001
    return base.split("-")[-1] if "-" in base else base

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=fin)

# --fit N: вписать импорт в N метров по длинной оси и посадить на землю.
# Чужие модели приходят в произвольных единицах (у скачанного КамАЗа ~700 у.е.),
# без этого камера либо внутри модели, либо за дальней плоскостью отсечения.
fit = opt("--fit")
if fit:
    fit = float(fit)
    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    lo = mathutils.Vector((1e18,) * 3); hi = mathutils.Vector((-1e18,) * 3)
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ mathutils.Vector(c)
            lo = mathutils.Vector((min(lo[i], w[i]) for i in range(3)))
            hi = mathutils.Vector((max(hi[i], w[i]) for i in range(3)))
    span = max(hi[i] - lo[i] for i in range(3)) or 1.0
    k = fit / span
    for ob in roots:
        ob.scale = [s * k for s in ob.scale]
        ob.location = [v * k for v in ob.location]
    bpy.context.view_layer.update()
    lo2 = mathutils.Vector((1e18,) * 3)
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ mathutils.Vector(c)
            lo2 = mathutils.Vector((min(lo2[i], w[i]) for i in range(3)))
    for ob in roots:
        ob.location.z -= lo2.z                     # поставить на землю
    bpy.context.view_layer.update()
    print("fit:", round(span, 2), "у.е. ->", fit, "м (k =", round(k, 5), ")")

for mat in bpy.data.materials:
    key = mat_key(mat.name)
    if key not in MATS or not mat.use_nodes:
        continue
    col, metal, rough, kind = MATS[key]
    b = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        continue
    b.inputs["Base Color"].default_value = srgb(col)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if kind == "coat" and "Coat Weight" in b.inputs:          # лак поверх эмали
        b.inputs["Coat Weight"].default_value = 0.35
        b.inputs["Coat Roughness"].default_value = 0.06
    if kind == "glass":
        if "Transmission Weight" in b.inputs:
            b.inputs["Transmission Weight"].default_value = 0.92
        if "IOR" in b.inputs:
            b.inputs["IOR"].default_value = 1.52
    if kind in ("lamp", "amber"):                     # рассеиватели слегка светятся
        b.inputs["Emission Color"].default_value = srgb(col)
        b.inputs["Emission Strength"].default_value = 0.9 if kind == "lamp" else 1.6
        if "Coat Weight" in b.inputs:
            b.inputs["Coat Weight"].default_value = 0.5
            b.inputs["Coat Roughness"].default_value = 0.04

# ---- фаски + сглаживание ------------------------------------------------------
# Без фасок модель из примитивов выглядит игрушечной: острое ребро не ловит блик.
# Bevel 8 мм + «сгладить по углу» — то, что отличает деталь от кубика.
bevel_w = float(opt("--bevel", "0.008"))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for ob in meshes:
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = bevel_w
    m.segments = 2
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(38)
    m.harden_normals = True
    m.miter_outer = "MITER_ARC"
bpy.ops.object.select_all(action="DESELECT")
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.shade_smooth()
for op in ("shade_smooth_by_angle", "shade_auto_smooth"):
    if hasattr(bpy.ops.object, op):
        try:
            getattr(bpy.ops.object, op)(angle=math.radians(38))
            break
        except Exception as e:
            print(op, "не сработал:", e)

# ---- сцена: студийный бэкдроп + три источника --------------------------------
world = bpy.data.worlds.new("W"); bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.55, 0.60, 0.66, 1.0)
bg.inputs[1].default_value = 0.55

bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, 0))
ground = bpy.context.object
gm = bpy.data.materials.new("ground"); gm.use_nodes = True
gb = gm.node_tree.nodes["Principled BSDF"]
gb.inputs["Base Color"].default_value = srgb("D7DBDF")
gb.inputs["Roughness"].default_value = 0.55
gb.inputs["Metallic"].default_value = 0.0
ground.data.materials.append(gm)

def area(name, loc, rot, size, energy):
    d = bpy.data.lights.new(name, type="AREA")
    d.size = size; d.energy = energy
    o = bpy.data.objects.new(name, d)
    o.location = loc; o.rotation_euler = rot
    bpy.context.collection.objects.link(o)
    return o
area("key",  (10, -12, 12), (math.radians(42), 0, math.radians(40)), 14, 26000)
area("fill", (-13, -9, 7),  (math.radians(58), 0, math.radians(-52)), 16, 9000)
area("rim",  (-9, 11, 9),   (math.radians(126), 0, math.radians(-38)), 12, 14000)

sun = bpy.data.lights.new("sun", type="SUN"); sun.energy = 2.1; sun.angle = math.radians(3)
so = bpy.data.objects.new("sun", sun)
so.rotation_euler = (math.radians(52), 0, math.radians(35))
bpy.context.collection.objects.link(so)

# ---- камера: сферические координаты вокруг центра модели ----------------------
# glTF Y-up → Blender Z-up, поэтому «высота» модели это Z сцены
lo = mathutils.Vector((1e9, 1e9, 1e9)); hi = mathutils.Vector((-1e9, -1e9, -1e9))
for ob in bpy.context.scene.objects:
    if ob.type != "MESH" or ob is ground:
        continue
    for c in ob.bound_box:
        w = ob.matrix_world @ mathutils.Vector(c)
        lo = mathutils.Vector((min(lo[i], w[i]) for i in range(3)))
        hi = mathutils.Vector((max(hi[i], w[i]) for i in range(3)))
target = mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + (hi.z - lo.z) * 0.42))

cam = bpy.data.cameras.new("cam"); cam.lens = 68; cam.clip_start = 0.05; cam.clip_end = 100000
co = bpy.data.objects.new("cam", cam); bpy.context.collection.objects.link(co)
co.location = target + mathutils.Vector((
    dist * math.cos(el) * math.cos(az), -dist * math.cos(el) * math.sin(az), dist * math.sin(el)))
co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = co

# ---- рендер -------------------------------------------------------------------
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.render.resolution_x = resw; sc.render.resolution_y = resh
sc.render.film_transparent = False
sc.view_settings.view_transform = "AgX" if "AgX" in [v.name for v in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
sc.view_settings.look = "AgX - Punchy" if sc.view_settings.view_transform == "AgX" else "None"

try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            got = False
            for d in prefs.devices:
                d.use = (d.type != "CPU")
                got = got or d.use
            if got:
                sc.cycles.device = "GPU"
                print("cycles:", backend, "GPU")
                break
        except Exception as e:
            print("backend", backend, "недоступен:", e)
except Exception as e:
    print("GPU не настроен, CPU:", e)

sc.render.filepath = fout
bpy.ops.render.render(write_still=True)
print("готово ->", fout)
