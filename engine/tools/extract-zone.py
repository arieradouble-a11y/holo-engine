# Blender headless: вырезать зону из фьюжн-скана (по долям bbox) и экспортнуть GLB.
#   blender -b --python extract-zone.py -- --in scan.glb --out part.glb \
#       --xmin 0 --xmax 0.70 --zmin 0.42 --zmax 1.0    (доли 0..1 вдоль осей Blender)
# Blender после импорта glTF: Z-up. X — длина, Z — высота.
import bpy, sys, bmesh

a = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
def opt(n, d=None): return a[a.index(n)+1] if n in a else d
fin, fout = opt("--in"), opt("--out")
xmin, xmax = float(opt("--xmin","0")), float(opt("--xmax","1"))
ymin, ymax = float(opt("--ymin","0")), float(opt("--ymax","1"))
zmin, zmax = float(opt("--zmin","0")), float(opt("--zmax","1"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=fin)
meshes = [o for o in bpy.context.scene.objects if o.type=="MESH"]
# объединить
bpy.context.view_layer.objects.active = meshes[0]
for m in meshes: m.select_set(True)
if len(meshes) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

# bbox в мировых координатах
import mathutils
cs = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
mnx=min(c.x for c in cs); mxx=max(c.x for c in cs)
mny=min(c.y for c in cs); mxy=max(c.y for c in cs)
mnz=min(c.z for c in cs); mxz=max(c.z for c in cs)
lx,ly,lz = mxx-mnx, mxy-mny, mxz-mnz
print("BBOX x[%.3f..%.3f] y[%.3f..%.3f] z[%.3f..%.3f]"%(mnx,mxx,mny,mxy,mnz,mxz))
def frac(v,mn,l): return (v-mn)/l if l else 0.5

me = obj.data
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()
todel = []
# зона ИСКЛЮЧЕНИЯ (--nxmin.. и т.д.): вычесть коробку из оставленного —
# нужно, чтобы у донорской кабины отрезать колесо и обрубок рамы, оставив бампер
nx0,nx1 = float(opt("--nxmin","1")), float(opt("--nxmax","-1"))
ny0,ny1 = float(opt("--nymin","1")), float(opt("--nymax","-1"))
nz0,nz1 = float(opt("--nzmin","1")), float(opt("--nzmax","-1"))
has_not = nx0<=nx1 or ny0<=ny1 or nz0<=nz1
def inrange(v,a,b): return True if a>b else (a<=v<=b)

for f in bm.faces:
    c = obj.matrix_world @ f.calc_center_median()
    fx,fy,fz = frac(c.x,mnx,lx), frac(c.y,mny,ly), frac(c.z,mnz,lz)
    keep = (xmin<=fx<=xmax) and (ymin<=fy<=ymax) and (zmin<=fz<=zmax)
    if keep and has_not and inrange(fx,nx0,nx1) and inrange(fy,ny0,ny1) and inrange(fz,nz0,nz1):
        keep = False
    if not keep: todel.append(f)
bmesh.ops.delete(bm, geom=todel, context='FACES')
bm.to_mesh(me); bm.free()

# центрировать в origin
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
obj.location = (0,0,0)

# опциональный трансформ в слот (Blender Z-up; glTF-yup конверсия на экспорте)
import math
sc = float(opt("--scale","1"))
rotz = float(opt("--rotz","0"))
loc = opt("--loc","0,0,0").split(",")
obj.scale = (sc,sc,sc)
obj.rotation_euler = (0,0,math.radians(rotz))
obj.location = (float(loc[0]), float(loc[1]), float(loc[2]))

bpy.ops.export_scene.gltf(filepath=fout, export_format='GLB', export_yup=True)
print("EXTRACT_DONE faces_kept=%d -> %s"%(len(me.polygons), fout))
