# Blender headless: децимация single-mesh скана + ужатие текстур для голограммы.
#   blender --background --python decimate.py -- --in ../x.glb --out ../x-lite.glb --tris 250000 --tex 2048
import bpy, sys, math

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
def opt(name, dflt=None):
    return argv[argv.index(name)+1] if name in argv else dflt

fin  = opt("--in")
fout = opt("--out")
target_tris = int(opt("--tris", "250000"))
tex_max = int(opt("--tex", "2048"))

# чистая сцена
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=fin)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
tris_before = sum(len(m.data.polygons) for m in meshes)  # приблизительно (n-gons)

for o in meshes:
    me = o.data
    ntri = sum(max(0, len(p.vertices)-2) for p in me.polygons)
    ratio = min(1.0, target_tris / max(1, ntri))
    if ratio < 0.999:
        mod = o.modifiers.new("dec", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)

# ужать текстуры
for img in bpy.data.images:
    if img.size[0] > tex_max or img.size[1] > tex_max:
        w = min(img.size[0], tex_max); h = min(img.size[1], tex_max)
        img.scale(w, h)

tris_after = 0
for o in [x for x in bpy.context.scene.objects if x.type == "MESH"]:
    tris_after += sum(max(0, len(p.vertices)-2) for p in o.data.polygons)

bpy.ops.export_scene.gltf(filepath=fout, export_format="GLB",
    export_yup=True, export_apply=True)

print("DECIMATE_DONE tris_before~%d tris_after~%d tex_max=%d" % (tris_before, tris_after, tex_max))
