# Blender headless: сборка «конструктора» — блоки (отдельно сгенерированные GLB)
# ставятся по bbox зон эталонного скана целого объекта. Эталон — GLB после
# blender-prep.py с материалами-зонами: bbox фейсов каждого материала задаёт
# целевой объём блока. Каждый блок масштабируется по ШИРИНЕ зоны (X — общий
# габарит у всех блоков техники) и ставится по якорям:
#   yanchor: front|center|back (вдоль длинной оси Y), zanchor: bottom|center|top.
# Экспорт: по одному GLB на блок в --outdir (NN_key.glb) — готово для
# build.js --parts (part-aware импорт, каждый файл = система).
#
#   blender --background --python blender-assemble.py -- \
#     --ref ../musorovoz-parts.glb --outdir ../musorovoz-blocks \
#     --parts '[{"file":"../kabina-clean.glb","zone":"kabina","order":1,
#                "yanchor":"front","zanchor":"bottom"}, ...]'
import bpy, sys, json, os
import mathutils

argv = sys.argv[sys.argv.index("--")+1:]
def arg(k, d=None):
    return argv[argv.index(k)+1] if k in argv else d

ref    = arg("--ref"); outdir = arg("--outdir"); parts = json.loads(arg("--parts"))
os.makedirs(outdir, exist_ok=True)

# ---- 1) bbox зон эталона ----------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ref)
zones = {}
for o in [x for x in bpy.context.scene.objects if x.type == 'MESH']:
    mw = o.matrix_world
    verts = o.data.vertices
    for p in o.data.polygons:
        name = o.data.materials[p.material_index].name if o.data.materials else 'default'
        mn, mx = zones.setdefault(name, [mathutils.Vector((1e9,)*3), mathutils.Vector((-1e9,)*3)])
        for vi in p.vertices:
            w = mw @ verts[vi].co
            mn.x=min(mn.x,w.x); mn.y=min(mn.y,w.y); mn.z=min(mn.z,w.z)
            mx.x=max(mx.x,w.x); mx.y=max(mx.y,w.y); mx.z=max(mx.z,w.z)
for n,(mn,mx) in zones.items():
    print("ZONE", n, tuple(round(v,3) for v in mn), tuple(round(v,3) for v in mx))

# ---- 2) блоки: масштаб по ширине зоны + постановка по якорям ------------------
for spec in parts:
    zn = zones[spec["zone"]]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=spec["file"])
    meshes = [x for x in bpy.context.scene.objects if x.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bmn = mathutils.Vector((1e9,)*3); bmx = mathutils.Vector((-1e9,)*3)
    for v in obj.bound_box:
        w = obj.matrix_world @ mathutils.Vector(v)
        bmn = mathutils.Vector(map(min, bmn, w)); bmx = mathutils.Vector(map(max, bmx, w))
    zmn, zmx = zn
    # масштаб: fit "min" (по умолчанию) — блок влезает в зону по всем осям
    # (нейро-блоки «квадратнее» зон); fit "x"|"y"|"z" — по конкретной оси
    # (например, шасси по ширине колеи). "scale" — ручной множитель поверх.
    ratios = {"x": (zmx.x - zmn.x) / max(1e-6, bmx.x - bmn.x),
              "y": (zmx.y - zmn.y) / max(1e-6, bmx.y - bmn.y),
              "z": (zmx.z - zmn.z) / max(1e-6, bmx.z - bmn.z)}
    fit = spec.get("fit", "min")
    s = min(ratios.values()) if fit == "min" else ratios[fit]
    s *= spec.get("scale", 1.0)
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bmn *= s; bmx *= s

    dx = (zmn.x + zmx.x)/2 - (bmn.x + bmx.x)/2
    ya = spec.get("yanchor", "center")
    dy = (zmn.y - bmn.y) if ya == "front" else (zmx.y - bmx.y) if ya == "back" else ((zmn.y+zmx.y)/2 - (bmn.y+bmx.y)/2)
    za = spec.get("zanchor", "bottom")
    dz = (zmn.z - bmn.z) if za == "bottom" else (zmx.z - bmx.z) if za == "top" else ((zmn.z+zmx.z)/2 - (bmn.z+bmx.z)/2)
    obj.location.x += dx + spec.get("dx", 0)
    obj.location.y += dy + spec.get("dy", 0)
    obj.location.z += dz + spec.get("dz", 0)
    bpy.ops.object.transform_apply(location=True)

    out = os.path.join(outdir, "%02d_%s.glb" % (spec.get("order", 0), spec["zone"]))
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True)
    print("PLACED", spec["zone"], "scale", round(s,3), "d", (round(dx,3),round(dy,3),round(dz,3)), "->", out)
