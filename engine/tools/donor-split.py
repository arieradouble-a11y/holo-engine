# Донорская модель → папка per-part GLB для режима "source": "parts".
#
#   blender -b --factory-startup -P tools/donor-split.py -- \
#           --in ../mtz-80_belarus.glb --out ../traktor-parts \
#           --group Frame,Wheel:part00 --group Engine:part01 --group Body,Glass:part02 \
#           --wheelbase 2.45 --rear-axle -1.23 --tris 55000
#
#   blender -b --factory-startup -P tools/donor-split.py -- --in <файл> --report
#           — только разбор: материалы, треугольники, габариты, где нос
#
# Зачем: у КамАЗов музея кабина донорская (donor-cab.py вырезает её из чужого
# шасси), а вот целую машину донором никто ещё не брал. Между тем донор, у
# которого меши разложены по осмысленным материалам, кладётся в структурный
# режим как есть — и снимает главную проблему процедурной техники: её узнают
# не по габариту, а по скруглениям, которых из коробок не набрать.
#
# ГЛАВНОЕ, ЧТО ДЕЛАЕТ СКРИПТ, — СОВМЕЩЕНИЕ СИСТЕМ КООРДИНАТ. Донор приезжает в
# своих единицах (у Sketchfab обычно сантиметры), со своей точкой отсчёта и не
# обязательно носом в +X, а маркеры, потоки и навесное оборудование объекта уже
# посчитаны в метрах от земли и от осей колёс. Поэтому привязка идёт НЕ по
# габаритной коробке (она врёт: ковш или стрела её растягивают), а ПО ОСЯМ
# КОЛЁС: колёсная база задаёт масштаб, задняя ось — начало отсчёта, низ колёс —
# нулевую отметку. Нос определяется сам: у трактора двигатель впереди кабины.
#
# ⚠ Текстуры и материалы выбрасываются: голограмма берёт из GLB только геометрию
#   (см. optimize-parts.py), а атлас донора — это десятки мегабайт мёртвого веса.
# ⚠ Лицензия и автор донора лежат в asset.extras исходного GLB; их нужно перенести
#   в поле credits конфига — CC-BY требует указания авторства.
import bpy, bmesh, sys, os, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(n, d=None):
    return a[a.index(n) + 1] if n in a else d
def opts(n):
    return [a[i + 1] for i, v in enumerate(a) if v == n]

SRC = opt('--in')
OUT = opt('--out')
REPORT = '--report' in a
GROUPS = [g.split(':') for g in opts('--group')]          # "Frame,Wheel:part00"
WHEELBASE = float(opt('--wheelbase', '0'))                 # метры между осями
REAR_AXLE = float(opt('--rear-axle', '0'))                 # куда поставить заднюю ось по X
TRIS = int(opt('--tris', '55000'))                         # потолок треугольников на всю модель
WHEEL_MAT = opt('--wheel-mat', 'Wheel')                    # материал колёс (по нему ищем оси)
NOSE_MAT = opt('--nose-mat', 'Engine')                     # что стоит у носа (для определения направления)
FLIP = '--flip' in a                                       # принудительно развернуть по X

if not SRC:
    print('donor-split: нужен --in'); sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def mats_of(ob):
    return [m.name for m in ob.data.materials if m] or ['—']


def tris_of(ob):
    return sum(max(0, len(p.vertices) - 2) for p in ob.data.polygons)


def bbox(obs):
    lo = Vector(( 1e9,  1e9,  1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob in obs:
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi


lo, hi = bbox(meshes)
size = hi - lo
print('импортировано мешей: %d · габарит %.1f × %.1f × %.1f (единицы файла)' % (len(meshes), size.x, size.y, size.z))
for ob in meshes:
    l, h = bbox([ob])
    print('  %-28s тр %7d  мат %-22s X %8.1f..%-8.1f' % (ob.name[:28], tris_of(ob), ','.join(mats_of(ob))[:22], l.x, h.x))

# ---- оси колёс: масштаб и точка отсчёта -------------------------------------
# ⚠ Колёса донора почти никогда не лежат по одному мешу на колесо: у МТЗ все
# четыре сидели в ДВУХ мешах, и кластеризация по центрам мешей давала «ось»
# посреди машины. Поэтому меши колёс сначала разваливаются на острова (loose),
# и уже островам ищутся общие X — это и есть оси.
wheels = [ob for ob in meshes if WHEEL_MAT in ','.join(mats_of(ob))]
if wheels:
    bpy.ops.object.select_all(action='DESELECT')
    for ob in wheels:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = wheels[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    wheels = [ob for ob in meshes if WHEEL_MAT in ','.join(mats_of(ob))]
    print('колёсных мешей после разбора на острова: %d' % len(wheels))

# остров считаем колесом, если он круглый в профиле (X ≈ Z) и достаточно крупный
rounds = []
for ob in wheels:
    l, h = bbox([ob])
    ex, ez = h.x - l.x, h.z - l.z
    if ez > size.z * 0.15 and abs(ex - ez) < 0.30 * max(ex, ez):
        rounds.append(((l.x + h.x) / 2, ez / 2, l.z))
rounds.sort()
axles = []
if rounds:
    cur = [rounds[0]]
    for c in rounds[1:]:
        if abs(c[0] - cur[-1][0]) < size.x * 0.10:
            cur.append(c)
        else:
            axles.append(cur); cur = [c]
    axles.append(cur)
    print('осей найдено: %d (из %d круглых островов)' % (len(axles), len(rounds)))
    for ax in axles:
        print('  ось X %7.2f · радиус %5.2f · колёс %d' % (
            sum(c[0] for c in ax) / len(ax), max(c[1] for c in ax), len(ax)))

if REPORT or not OUT:
    print('\n(режим отчёта: файлы не пишутся)')
    sys.exit(0)

if len(axles) < 2 or WHEELBASE <= 0:
    print('donor-split: нужны две оси колёс и --wheelbase'); sys.exit(1)

axC = [(sum(c[0] for c in ax) / len(ax), max(c[1] for c in ax), min(c[2] for c in ax)) for ax in axles]
axC.sort(key=lambda t: t[0])
base_units = abs(axC[-1][0] - axC[0][0])
S = WHEELBASE / base_units
# У трактора задняя ось — та, где колёса БОЛЬШЕ: по ней и ориентируемся, а не
# по «первой слева», иначе модель приедет задом наперёд.
rear_is_first = axC[0][1] > axC[-1][1]
rear_x, front_x = (axC[0][0], axC[-1][0]) if rear_is_first else (axC[-1][0], axC[0][0])
# нос: там, где двигатель (или просто противоположно кабине)
nose = [ob for ob in meshes if NOSE_MAT in ','.join(mats_of(ob))]
if nose:
    l, h = bbox(nose)
    nose_x = (l.x + h.x) / 2
else:
    nose_x = front_x
flip = (nose_x < rear_x) != FLIP
print('масштаб %.5f (база %.1f ед. → %.2f м) · задняя ось X=%.1f · нос %s · разворот %s'
      % (S, base_units, WHEELBASE, rear_x, 'X+' if nose_x > rear_x else 'X−', 'да' if flip else 'нет'))

ground = min(c[2] for c in axC) - 0  # низ колёс в единицах файла
for ob in meshes:
    ob.scale = (S, S, S)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for ob in meshes:
    ob.location = (-rear_x * S + REAR_AXLE, ob.location.y, -ground * S)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
if flip:
    for ob in meshes:
        ob.scale = (-1, 1, 1)
        ob.location = (2 * REAR_AXLE - ob.location.x, ob.location.y, ob.location.z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    for ob in meshes:                                   # зеркальный масштаб выворачивает нормали
        me = ob.data
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()

lo, hi = bbox(meshes)
print('после совмещения: X %.2f..%.2f · Y %.2f..%.2f · Z %.2f..%.2f (метры, Z вверх)'
      % (lo.x, hi.x, lo.y, hi.y, lo.z, hi.z))

# ---- сборка групп, прореживание, экспорт -------------------------------------
# ⚠ Разбор колёс на острова оставляет сотни мешей: их надо СКЛЕИТЬ обратно в
# группу, иначе в бандл уезжает по мешу на спицу (у МТЗ было 950 штук и 4.7 МБ),
# а прореживание с порогом «мелочь не трогаем» на них просто не срабатывает.
# ⚠ Состав групп считается ДО первой склейки и хранится ИМЕНАМИ: join удаляет
#   объекты, и список meshes после него держит мёртвые ссылки.
# ⚠ В print только ASCII-стрелки: stdout Blender на Windows — cp1251, и одна
#   «→» роняет скрипт в середине экспорта (та же грабля, что в egrul_founders).
tag = {ob.name: set(mats_of(ob)) for ob in meshes}
total = sum(tris_of(ob) for ob in meshes)
plan = []
for spec, part in GROUPS:
    want = set(spec.split(','))
    plan.append((spec, part, [n for n, ms in tag.items() if ms & want]))
os.makedirs(OUT, exist_ok=True)
used = set()
for spec, part, names in plan:
    sel = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
    if not sel:
        print('  ! group %s: nothing matched' % spec); continue
    share = sum(tris_of(o) for o in sel)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in sel:
        ob.select_set(True); used.update(names)
    bpy.context.view_layer.objects.active = sel[0]
    if len(sel) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.data.materials.clear()
    if total > TRIS and tris_of(obj) > 400:
        m = obj.modifiers.new('dec', 'DECIMATE')
        m.ratio = TRIS / total
        bpy.ops.object.modifier_apply(modifier=m.name)
    path = os.path.join(OUT, part + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_materials='NONE', export_yup=True, export_apply=True)
    print('  + %s <- %s : tris %d -> %d, %.1f MB'
          % (part + '.glb', spec, share, tris_of(obj), os.path.getsize(path) / 1048576))
left = [n for n in tag if n not in used]
if left:
    print('  ! not grouped: %d meshes' % len(left))
