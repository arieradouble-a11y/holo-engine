# Blender headless: натянуть свотч триплонарно (box-projection, без UV) на «кузовные»
# детали GLB и отрендерить. Демонстрация «img-gen свотч → материал в Blender».
#   blender -b --python blender-texture.py -- --in cab.glb --tex swatch.png --out r.png \
#       --match e8720f --scale 1.5
import bpy, sys, math, mathutils

a = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
def opt(n,d=None): return a[a.index(n)+1] if n in a else d
fin, tex, fout = opt("--in"), opt("--tex"), opt("--out")
def s2l(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4   # sRGB -> linear (Blender base color)
match = opt("--match","e8720f"); mr,mg,mb = (s2l(int(match[i:i+2],16)/255) for i in (0,2,4))
scale = float(opt("--scale","1.5"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=fin)

img = bpy.data.images.load(tex)
def close(c): return abs(c[0]-mr)<0.1 and abs(c[1]-mg)<0.1 and abs(c[2]-mb)<0.1
matched = 0

for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'), None)
    if not bsdf: continue
    bc = bsdf.inputs['Base Color'].default_value
    if not close(bc): continue                         # трогаем только «кузовной» цвет
    nt = mat.node_tree
    tcoord = nt.nodes.new('ShaderNodeTexCoord')
    mapp = nt.nodes.new('ShaderNodeMapping'); mapp.inputs['Scale'].default_value = (scale,scale,scale)
    timg = nt.nodes.new('ShaderNodeTexImage'); timg.image = img
    timg.projection = 'BOX'; timg.projection_blend = 0.3
    nt.links.new(tcoord.outputs['Generated'], mapp.inputs['Vector'])
    nt.links.new(mapp.outputs['Vector'], timg.inputs['Vector'])
    nt.links.new(timg.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.7
    matched += 1
print("MATERIALS_TEXTURED =", matched)

# камера + свет (iso)
objs = [o for o in bpy.context.scene.objects if o.type=='MESH']
bb_min = mathutils.Vector((1e9,)*3); bb_max = mathutils.Vector((-1e9,)*3)
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        bb_min = mathutils.Vector(map(min, bb_min, w)); bb_max = mathutils.Vector(map(max, bb_max, w))
center = (bb_min+bb_max)/2; R = max(bb_max-bb_min)
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); bpy.context.scene.collection.objects.link(cam)
d = mathutils.Vector((0.9,1.0,0.55)).normalized()   # Blender Z-up: (x, -depth, up)
cam.location = center + d*R*2.0
look = (center - cam.location).normalized()
cam.rotation_euler = look.to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera = cam
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun','SUN')); bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(55), math.radians(20), math.radians(40))
world = bpy.data.worlds.new('w'); bpy.context.scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.11,0.13,0.15,1)

sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x = sc.render.resolution_y = 800
sc.render.filepath = fout
bpy.ops.render.render(write_still=True)
print("TEXTURE_RENDER_DONE ->", fout)
