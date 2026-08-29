# Донорская модель → папка per-part GLB для режима "source": "parts".
#
#   blender -b --factory-startup -P tools/donor-split.py -- \
#           --in ../mtz-80_belarus.glb --out ../traktor-parts \
#           --group Frame,Wheel:part00 --group Engine:part01 --group Body,Glass:part02 \
#           --wheelbase 2.45 --rear-axle -1.23 --tris 55000
#
#   blender -b --factory-startup -P tools/donor-split.py -- --in <файл> --report
#           — только разбор: материалы, узлы, треугольники, габариты, где нос
#
# --group принимает и ИМЕНА МАТЕРИАЛОВ, и ИМЕНА УЗЛОВ (подстрокой, без учёта
# регистра): у МТЗ осмысленны материалы (Frame/Engine/Body/Wheel/Glass), у
# КС-5363 — узлы (base_frame, right_front_outrigger, rear_azle).
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
DROP = [t for t in (opt('--drop', '') or '').split(',') if t]   # выбросить совсем (интерьер и т. п.)

if not SRC:
    print('donor-split: нужен --in'); sys.exit(1)

def mats_of(ob):
    return [m.name for m in ob.data.materials if m] or ['—']


def bbox(obs):
    lo = Vector(( 1e9,  1e9,  1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob in obs:
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi

def path_of(ob):
    """Имя детали ВМЕСТЕ С РОДИТЕЛЯМИ.

    ⚠ В glTF осмысленное имя часто висит на УЗЛЕ, а меш лежит в его безымянном
    ребёнке: у КС-4574 узлы называются Strela_1, Koleno_2, Bashmak_19, а сами
    меши импортируются как Object_6, Object_8, Object_40. Матчить только по
    имени объекта означало бы не найти ничего.
    """
    names, cur = [], ob
    while cur is not None:
        names.append(cur.name)
        cur = cur.parent
    return '/'.join(names)


def matches(ob, token):
    """Деталь относится к токену, если совпал материал ИЛИ имя узла/родителя.

    У одних доноров осмысленны материалы (МТЗ: Frame/Engine/Body/Wheel/Glass),
    у других — узлы (КС-5363: base_frame, right_front_outrigger; КС-4574:
    Strela, Koleno, ogplovok, Bashmak, Ressora).
    """
    if token in mats_of(ob):
        return True
    return token.lower() in path_of(ob).lower()


def tris_of(ob):
    return sum(max(0, len(p.vertices) - 2) for p in ob.data.polygons)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if DROP:
    kill = [ob for ob in meshes if any(matches(ob, t) for t in DROP)]
    for ob in kill:
        bpy.data.objects.remove(ob, do_unlink=True)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    print('выброшено по --drop: %d мешей' % len(kill))
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)




lo, hi = bbox(meshes)
size = hi - lo
# ⚠ ДОНОР НЕ ОБЯЗАН ЛЕЖАТЬ ВДОЛЬ X. У КС-5363 длина оказалась по Y, а по Z стояла
# поднятая стрела на 23 м — вся дальнейшая логика (оси колёс, нос, совмещение)
# считает длину по X, поэтому модель сначала доворачивается вокруг вертикали.
YAW = opt('--yaw', 'auto')
yaw = 90.0 if (YAW == 'auto' and size.y > size.x) else (0.0 if YAW == 'auto' else float(YAW))
if abs(yaw) > 1e-6:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.transform.rotate(value=math.radians(yaw), orient_axis='Z')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lo, hi = bbox(meshes)
    size = hi - lo
    print('доворот вокруг вертикали: %+.0f° (длинная ось приведена к X)' % yaw)
print('импортировано мешей: %d · габарит %.1f × %.1f × %.1f (единицы файла)' % (len(meshes), size.x, size.y, size.z))
for ob in sorted(meshes, key=lambda o: -tris_of(o))[:40]:
    l, h = bbox([ob])
    print('  %-40s тр %7d  мат %-14s X %7.2f..%-7.2f' % (
        path_of(ob)[:40], tris_of(ob), ','.join(mats_of(ob))[:14], l.x, h.x))
if len(meshes) > 40:
    print('  ... и ещё %d мешей (показаны 40 самых тяжёлых)' % (len(meshes) - 40))

# ---- оси колёс: масштаб и точка отсчёта -------------------------------------
# ⚠ Колёса донора почти никогда не лежат по одному мешу на колесо: у МТЗ все
# четыре сидели в ДВУХ мешах, и кластеризация по центрам мешей давала «ось»
# посреди машины. Поэтому меши колёс сначала разваливаются на острова (loose),
# и уже островам ищутся общие X — это и есть оси.
wheels = [ob for ob in meshes if matches(ob, WHEEL_MAT)]
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
    wheels = [ob for ob in meshes if matches(ob, WHEEL_MAT)]
    print('колёсных мешей после разбора на острова: %d' % len(wheels))

# остров считаем колесом, если он круглый в профиле (X ≈ Z) и достаточно крупный
# ⚠ Порог «крупности» колеса берётся от САМОГО БОЛЬШОГО КАНДИДАТА, а не от габарита
# модели: у крана габарит по высоте задаёт поднятая стрела (23 м), и колесо ⌀1 м
# при пороге «15% габарита» отсеивалось вместе с мусором — оси не находились вовсе.
cand = []
for ob in wheels:
    l, h = bbox([ob])
    ex, ez = h.x - l.x, h.z - l.z
    if abs(ex - ez) < 0.30 * max(ex, ez, 1e-6):
        cand.append(((l.x + h.x) / 2, ez / 2, l.z, ez))
maxD = max([c[3] for c in cand], default=0)
rounds = [(c[0], c[1], c[2]) for c in cand if c[3] > 0.40 * maxD]
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

# Донор может приехать уже в метрах (у МТЗ и КС-4574 так и было) — тогда масштаб
# не вычисляется, а берётся явным --scale, и совмещение идёт по габариту.
SCALE = float(opt('--scale', '0'))
ANCHOR_X = float(opt('--anchor-x', '0'))
if len(axles) < 2 and WHEELBASE > 0:
    print('donor-split: для --wheelbase нужны две оси колёс'); sys.exit(1)

axC = [(sum(c[0] for c in ax) / len(ax), max(c[1] for c in ax), min(c[2] for c in ax)) for ax in axles]
axC.sort(key=lambda t: t[0])
# У трёхосного шасси задняя тележка — ДВЕ оси рядом: базой считаем расстояние от
# одиночной оси до СРЕДНЕЙ точки тележки, иначе масштаб уедет на полметра.
if len(axC) > 2:
    solo, bogie = (axC[0], axC[1:]) if (axC[1][0] - axC[0][0]) > (axC[-1][0] - axC[-2][0]) else (axC[-1], axC[:-1])
    axC = [solo, (sum(a[0] for a in bogie) / len(bogie), max(a[1] for a in bogie), min(a[2] for a in bogie))]
    axC.sort(key=lambda t: t[0])
base_units = abs(axC[-1][0] - axC[0][0]) if len(axC) >= 2 else 0
S = SCALE if SCALE > 0 else (WHEELBASE / base_units if (WHEELBASE > 0 and base_units) else 1.0)
# У трактора задняя ось — та, где колёса БОЛЬШЕ: по ней и ориентируемся, а не
# по «первой слева», иначе модель приедет задом наперёд.
rear_is_first = axC[0][1] > axC[-1][1]
rear_x, front_x = (axC[0][0], axC[-1][0]) if rear_is_first else (axC[-1][0], axC[0][0])
# нос: там, где двигатель (или просто противоположно кабине)
nose = [ob for ob in meshes if matches(ob, NOSE_MAT)]
if nose:
    l, h = bbox(nose)
    nose_x = (l.x + h.x) / 2
else:
    nose_x = front_x
flip = (nose_x < rear_x) != FLIP
print('масштаб %.5f (база %.1f ед. → %.2f м) · задняя ось X=%.1f · нос %s · разворот %s'
      % (S, base_units, WHEELBASE, rear_x, 'X+' if nose_x > rear_x else 'X−', 'да' if flip else 'нет'))

ground = min(c[2] for c in axC) if axC else lo.z   # низ колёс (или низ габарита)
for ob in meshes:
    ob.scale = (S, S, S)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
# точка отсчёта: задняя ось (если её просили) либо центр габарита по X
anchor_src = rear_x if (REAR_AXLE or WHEELBASE > 0) and axC else (lo.x + hi.x) / 2
anchor_dst = REAR_AXLE if (REAR_AXLE or WHEELBASE > 0) and axC else ANCHOR_X
for ob in meshes:
    ob.location = (-anchor_src * S + anchor_dst, ob.location.y, -ground * S)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
if flip:
    for ob in meshes:
        ob.scale = (-1, 1, 1)
        ob.location = (2 * anchor_dst - ob.location.x, ob.location.y, ob.location.z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    for ob in meshes:                                   # зеркальный масштаб выворачивает нормали
        me = ob.data
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()

# ---- перенос отдельных узлов ------------------------------------------------
# Нужен там, где из донора выброшена промежуточная секция: у КС-5363 стрела
# собрана из базовой секции, ВСТАВКИ и оголовка, и без вставки оголовок надо
# подтянуть по оси стрелы, иначе он повиснет в воздухе.
#   --move boom_3,blocks:-1.59:0:-5.79   (токены : dx : dy : dz, метры)
# ⚠ Переносы применяются ДО поворотов: сдвиг задан в осях донора.
for spec in opts('--move'):
    toks, dx, dy, dz = spec.rsplit(':', 3)
    sel = [ob for ob in meshes if any(matches(ob, w) for w in toks.split(','))]
    if not sel:
        print('  ! move %s: nothing matched' % toks); continue
    for ob in sel:
        ob.location = (ob.location.x + float(dx), ob.location.y + float(dy), ob.location.z + float(dz))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in sel:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    l, h = bbox(sel)
    print('  перенесено %s на (%s, %s, %s): теперь X %.2f..%.2f Z %.2f..%.2f'
          % (toks, dx, dy, dz, l.x, h.x, l.z, h.z))

# ---- поворот отдельных узлов (стрела крана, ковш, отвал) ---------------------
# ⚠ Донор часто приезжает в ТРАНСПОРТНОМ положении: у КС-4574 стрела лежит, а
# башмаки подняты на 1.7 м. А у КС-5363 наоборот — стрела задрана на 74°, и
# габарит по высоте (23.6 м) съедает кадр: движок нормализует по большему
# измерению, и сама машина занимает пятую часть картинки. Поэтому узлы можно
# доворачивать вокруг оси ширины (Y в Blender) относительно явного шарнира.
#   --rotate boom,blocks:-45:0.60:1.61   (токены : градусы : шарнир X : шарнир Z)
for spec in opts('--rotate'):
    toks, deg, px, pz = spec.rsplit(':', 3)
    want = toks.split(',')
    sel = [ob for ob in meshes if any(matches(ob, w) for w in want)]
    if not sel:
        print('  ! rotate %s: nothing matched' % toks); continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in sel:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]
    bpy.context.scene.cursor.location = (float(px), 0.0, float(pz))
    bpy.ops.transform.rotate(value=math.radians(float(deg)), orient_axis='Y',
                             center_override=(float(px), 0.0, float(pz)))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    l, h = bbox(sel)
    print('  повёрнуто %s на %s° вокруг (%s, %s): теперь X %.2f..%.2f Z %.2f..%.2f'
          % (toks, deg, px, pz, l.x, h.x, l.z, h.z))

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
# ⚠ Группа «*» забирает ВСЁ, что не разобрали предыдущие: без неё детали донора
# теряются молча (на КС-4574 за бортом осталось 97 мешей и треть треугольников —
# выхлоп, радиатор, двери, салон, гидравлика). Ставить её последней.
plan = []
claimed = set()
for spec, part in GROUPS:
    want = set(spec.split(','))
    if '*' in want:
        plan.append((spec, part, [ob.name for ob in meshes if ob.name not in claimed]))
        claimed.update(ob.name for ob in meshes)
        continue
    # Группа собирается ПО МАТЕРИАЛУ ИЛИ ПО ИМЕНИ УЗЛА: у одних доноров осмысленны
    # материалы (у МТЗ — Frame/Engine/Body/Wheel/Glass), у других узлы (у КС-5363 —
    # base_frame, right_front_outrigger, rear_azle). Имя узла матчится подстрокой
    # без учёта регистра, материал — точным совпадением.
    names = [ob.name for ob in meshes if ob.name not in claimed and any(matches(ob, w) for w in want)]
    claimed.update(names)
    plan.append((spec, part, names))
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
