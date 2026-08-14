# Blender headless: облегчение папки per-part GLB для голограммы.
#   blender -b --python optimize-parts.py -- --in ../ilosos-i2t-parts --out ../ilosos-i2t-parts-lite \
#           --tris 5000 --tex strip
#
# Зачем: в режиме "source": "parts" движок берёт из GLB только геометрию, а
# системы раскидывает по именам файлов (partAssets -> matRules), не по материалам.
# Текстуры скана в бандл при этом всё равно попадают — мёртвым грузом. На илососе
# это 24.3 МБ из 28.8 (причём один и тот же атлас лежит в кабине и цистерне дважды).
#
# --tex strip  — выкинуть изображения (по умолчанию: голограмме они не нужны)
# --tex 1024   — ужать до N пикселей по большей стороне, если текстуры всё же нужны
#                (например, папка потом идёт в blender-pbr.py на рендер)
#
# Оригиналы не трогаются: результат всегда пишется в отдельную папку.
import bpy, sys, os, shutil, glob

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
def opt(name, dflt=None):
    return argv[argv.index(name)+1] if name in argv else dflt

din       = opt("--in")
dout      = opt("--out")
tgt_tris  = int(opt("--tris", "5000"))
tex_mode  = opt("--tex", "strip")
min_tris  = int(opt("--min-tris", "500"))   # мелочь не трогаем, там портить нечего

if not din or not dout:
    print("optimize-parts: нужны --in и --out"); sys.exit(1)

os.makedirs(dout, exist_ok=True)
parts = sorted(glob.glob(os.path.join(din, "*.glb")))
if not parts:
    print("optimize-parts: в " + din + " нет *.glb"); sys.exit(1)


def tris_of(obj):
    return sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)


def strip_textures():
    """Убрать изображения, сохранив материалы и их имена."""
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        for node in list(mat.node_tree.nodes):
            if node.type == "TEX_IMAGE":
                mat.node_tree.nodes.remove(node)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def resize_textures(px):
    for img in bpy.data.images:
        if img.size[0] > px or img.size[1] > px:
            img.scale(min(img.size[0], px), min(img.size[1], px))


rows = []
for src in parts:
    name = os.path.basename(src)
    dst = os.path.join(dout, name)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    before = sum(tris_of(o) for o in meshes)

    for o in meshes:
        n = tris_of(o)
        if n <= min_tris or n <= tgt_tris:
            continue
        mod = o.modifiers.new("dec", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = tgt_tris / float(n)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)

    if tex_mode == "strip":
        strip_textures()
    else:
        resize_textures(int(tex_mode))

    after = sum(tris_of(o) for o in
                [x for x in bpy.context.scene.objects if x.type == "MESH"])

    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB",
                              export_yup=True, export_apply=True)

    rows.append((name, before, after,
                 os.path.getsize(src), os.path.getsize(dst)))

# _map.json и прочие спутники — рядом, они не GLB и нужны другим инструментам
for extra in glob.glob(os.path.join(din, "*.json")):
    shutil.copy(extra, dout)

print("")
print("%-14s %9s %9s %10s %10s" % ("деталь", "тр. до", "тр. после", "МБ до", "МБ после"))
for name, b, a, sb, sa in rows:
    print("%-14s %9d %9d %10.2f %10.2f" % (name, b, a, sb/1e6, sa/1e6))

tb = sum(r[3] for r in rows); ta = sum(r[4] for r in rows)
print("%-14s %9d %9d %10.2f %10.2f" % ("ИТОГО",
      sum(r[1] for r in rows), sum(r[2] for r in rows), tb/1e6, ta/1e6))
print("OPTIMIZE_PARTS_DONE saved=%.2fMB (%.0f%%) tex=%s tris=%d"
      % ((tb-ta)/1e6, 100.0*(tb-ta)/tb if tb else 0, tex_mode, tgt_tris))
