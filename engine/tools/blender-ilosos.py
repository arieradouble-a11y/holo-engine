# Илосос КО-560 в Blender из дампа декларативной геометрии (decl-dump.mjs).
# Агентный цикл как у "Kimi + Blender MCP": скрипт строит сцену, рендерит,
# модель смотрит на кадр и правит скрипт. Никакой генеративки — чистый bpy.
#
#   blender -b --factory-startup -P tools/blender-ilosos.py -- <prims.json> <out_dir> quick|final [--blend <path.blend>]
#
# Оси: движок Y-вверх (three) → Blender Z-вверх поворотом C=Rx(+90°).
# Примитивы движка осевые вдоль Y → бленд-примитивы (вдоль Z) доворачиваются Rx(-90°).
import bpy, bmesh, json, math, os, sys
from math import radians, pi, cos, sin
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
PRIMS_JSON, OUT_DIR, MODE = argv[0], argv[1], argv[2]
BLEND_OUT = argv[argv.index('--blend') + 1] if '--blend' in argv else None
CAMS = argv[argv.index('--cams') + 1] if '--cams' in argv else 'truck'
# донорская кабина: реальный меш вместо процедурной. Примитивы при этом надо
# дампить с --skip kabina,glass, иначе две кабины встанут одна в другую.
CAB_GLB = argv[argv.index('--cab-glb') + 1] if '--cab-glb' in argv else None
def farg(name, dflt):
    return float(argv[argv.index(name) + 1]) if name in argv else dflt
CAB_WIDTH = farg('--cab-width', 2.50)    # ширина кузовной панели «Kabina» (габарит 2500)
CAB_ROOF  = farg('--cab-roof', 3.05)     # куда сажаем крышу
CAB_NOSE  = farg('--cab-nose', 4.22)     # куда сажаем самую переднюю точку (бампер)
CAB_ROTZ  = farg('--cab-rotz', 180.0)    # у донора нос по X-min → развернуть
CAB_CUT   = farg('--cab-cut', -1e9)      # срезать обрубок донорской рамы ниже этой высоты…
CAB_CUT_X = farg('--cab-cut-x', 3.50)    # …но только позади этой отметки, иначе срежется бампер
CAB_TOP   = farg('--cab-top', 1e9)       # срезать всё выше (у донора над крышей своя выхлопная труба)
CAB_REAR  = farg('--cab-rear', -1e9)     # срезать всё ПОЗАДИ кабины: выхлопной стояк донора
                                         # стоит за задней стенкой и лезет в надстройку
# --export-cab: выгрузить ПОСАЖЕННУЮ кабину отдельным GLB (для parts-режима движка)
# и выйти, не рендеря. Так математика посадки живёт в одном месте.
EXPORT_CAB = argv[argv.index('--export-cab') + 1] if '--export-cab' in argv else None
CAB_TRIS   = int(farg('--cab-tris', 0))  # дополнительная децимация перед выгрузкой
# донорское колесо: наш примитивный «блин» без протектора читается игрушкой.
# Позиции берём из самих примитивов, поэтому работает для любой машины на общем шасси.
WHEEL_GLB  = argv[argv.index('--wheel-glb') + 1] if '--wheel-glb' in argv else None
# --export-glb <path> --export-mats a,b: выгрузить подмножество систем (для parts-режима)
EXPORT_GLB  = argv[argv.index('--export-glb') + 1] if '--export-glb' in argv else None
EXPORT_MATS = (argv[argv.index('--export-mats') + 1].split(',')) if '--export-mats' in argv else None
os.makedirs(OUT_DIR, exist_ok=True)

C = Matrix.Rotation(radians(90), 4, 'X')          # engine → blender
RXm90 = Matrix.Rotation(radians(-90), 4, 'X')     # blender Z-prim → engine Y-prim

def mat4(e):  # THREE .elements — column-major
    return Matrix(((e[0], e[4], e[8],  e[12]),
                   (e[1], e[5], e[9],  e[13]),
                   (e[2], e[6], e[10], e[14]),
                   (e[3], e[7], e[11], e[15])))

# ---- материалы: имя → (rgb linear, metallic, rough, extras) -------------------
ORANGE = (0.685, 0.075, 0.010)     # КамАЗ/Коммаш оранжевый
def spec(color, metallic=0.0, rough=0.5, coat=0.0, emit=None, emit_str=0.0, glass=False):
    return dict(color=color, metallic=metallic, rough=rough, coat=coat, emit=emit, emit_str=emit_str, glass=glass)

MATS = {
    'kabina':       spec(ORANGE, 0.0, 0.32, coat=0.6),
    'tank':         spec(ORANGE, 0.0, 0.38, coat=0.4),
    'hatch':        spec(ORANGE, 0.0, 0.38, coat=0.4),
    'boom':         spec((0.42, 0.055, 0.008), 0.0, 0.48),        # стрела: тёмный оранжевый
    'fwing':        spec((0.020, 0.021, 0.024), 0.0, 0.62),       # чёрный пластик крыльев
    'shassi':       spec((0.030, 0.032, 0.036), 0.2, 0.60),       # графит рамы
    'tyre':         spec((0.014, 0.014, 0.015), 0.0, 0.92),
    'ftyre':        'tyre',
    'rim':          spec((0.42, 0.43, 0.45), 0.9, 0.35),
    'frim':         'rim',
    'kabina-dark':  spec((0.018, 0.019, 0.021), 0.0, 0.55),
    'glass':        spec((0.80, 0.88, 0.92), 0.0, 0.04, glass=True),
    'kabina-lamp':  spec((0.92, 0.92, 0.90), 0.0, 0.15, emit=(1.0, 0.97, 0.88), emit_str=2.5),
    'shassi-lamp':  spec((0.55, 0.02, 0.02), 0.0, 0.20, emit=(1.0, 0.05, 0.03), emit_str=1.6),
    'kabina-amber': spec((0.75, 0.30, 0.02), 0.0, 0.25, emit=(1.0, 0.45, 0.05), emit_str=1.4),
    'kabina-chrome': spec((0.82, 0.83, 0.85), 1.0, 0.12),         # шильд, накладки решётки
    'kabina-grille': spec((0.010, 0.010, 0.012), 0.1, 0.65),      # чёрная сетка решётки
    'tank-amber':   spec((0.75, 0.30, 0.02), 0.0, 0.25, emit=(1.0, 0.45, 0.05), emit_str=1.4),
    'tank-lamp':    spec((0.92, 0.92, 0.90), 0.0, 0.15, emit=(1.0, 0.97, 0.88), emit_str=2.0),
    'pump':         spec((0.52, 0.53, 0.55), 0.9, 0.30),          # алюминий насоса
    'tank-dark':    spec((0.020, 0.021, 0.024), 0.0, 0.55),       # тёмная окантовка бака
    'pump-body':    spec(ORANGE, 0.0, 0.36, coat=0.4),            # крашеная обшивка отсека насоса
    'pump-dark':    spec((0.035, 0.036, 0.040), 0.3, 0.60),       # жалюзи: тёмные, иначе бликуют хромом
    'tank-panel':   spec((0.70, 0.71, 0.72), 0.0, 0.45),          # светлая сервисная дверца (как на фото)
    'tank-stripe':  spec((0.72, 0.42, 0.02), 0.0, 0.40),          # фирменная жёлтая полоса Коммаш
    'reel':         spec((0.30, 0.31, 0.33), 0.75, 0.42),         # катушка рукава ВД
    'water':        spec((0.46, 0.48, 0.50), 0.35, 0.58),         # оцинковка водозабора
    'tank-red':     spec((0.55, 0.02, 0.02), 0.0, 0.20, emit=(1.0, 0.05, 0.03), emit_str=1.6),
    'body':         spec(ORANGE, 0.0, 0.38, coat=0.4),            # кузов мусоровоза
    'body-dark':    spec((0.020, 0.021, 0.024), 0.0, 0.55),       # пояса и накладки кузова
    'body-amber':   spec((0.75, 0.30, 0.02), 0.0, 0.25, emit=(1.0, 0.45, 0.05), emit_str=1.4),
    'bunker':       spec((0.40, 0.042, 0.006), 0.0, 0.44),        # приёмный бункер: темнее кузова
    'press':        spec((0.34, 0.35, 0.37), 0.85, 0.36),         # плита уплотнения
    'eject':        spec((0.40, 0.41, 0.43), 0.85, 0.34),         # выталкивающая плита
    'lift':         spec((0.26, 0.27, 0.29), 0.80, 0.44),         # опрокидыватель
    'lift-red':     spec((0.55, 0.02, 0.02), 0.0, 0.20, emit=(1.0, 0.05, 0.03), emit_str=1.6),
    'hopper':       spec(ORANGE, 0.0, 0.38, coat=0.4),            # бункер КДМ
    'hopper-amber': spec((0.75, 0.30, 0.02), 0.0, 0.25, emit=(1.0, 0.45, 0.05), emit_str=1.4),
    'hopper-red':   spec((0.55, 0.02, 0.02), 0.0, 0.20, emit=(1.0, 0.05, 0.03), emit_str=1.6),
    'conveyor':     spec((0.32, 0.33, 0.35), 0.80, 0.42),         # транспортёр и диск
    'plow':         spec((0.62, 0.30, 0.02), 0.0, 0.40),          # отвал: жёлтый сигнальный
    'brush':        spec((0.20, 0.21, 0.23), 0.55, 0.62),         # щётка
    'brine':        spec((0.46, 0.48, 0.50), 0.35, 0.55),         # баки рассола
    'rama':         spec((0.070, 0.075, 0.085), 0.4, 0.58),       # рама-основание агрегата
    'motor':        spec((0.055, 0.16, 0.30), 0.3, 0.44),         # электродвигатель: синий
    'mufta':        spec((0.62, 0.30, 0.02), 0.0, 0.40),          # кожух муфты: сигнальный жёлтый
    'val':          spec((0.46, 0.47, 0.49), 0.90, 0.28),         # вал и подшипники: сталь
    'ulitka':       spec((0.055, 0.16, 0.30), 0.3, 0.40),         # улитка насоса: в цвет двигателя
    'koleso':       spec((0.60, 0.42, 0.16), 0.85, 0.32),         # рабочее колесо: бронза
    'pipe':         spec((0.30, 0.31, 0.33), 0.75, 0.44),         # обвязка и арматура
    'kip':          spec((0.72, 0.73, 0.74), 0.2, 0.36),          # КИП: приборные корпуса
    'shkaf':        spec((0.42, 0.44, 0.46), 0.25, 0.48),         # корпус шкафа: светло-серый RAL7035
    'dver':         spec((0.44, 0.46, 0.48), 0.25, 0.42),         # дверь чуть светлее корпуса
    'dver-glass':   spec((0.80, 0.88, 0.92), 0.0, 0.05, glass=True),
    'vvod':         spec((0.030, 0.032, 0.036), 0.2, 0.52),       # аппараты ввода: чёрный пластик
    'vvod-red':     spec((0.55, 0.02, 0.02), 0.0, 0.25, emit=(1.0, 0.06, 0.03), emit_str=1.2),
    'pch':          spec((0.075, 0.078, 0.085), 0.3, 0.46),       # частотник: тёмный корпус
    'pch-panel':    spec((0.30, 0.31, 0.33), 0.2, 0.44),
    'pch-lamp':     spec((0.10, 0.65, 0.55), 0.0, 0.20, emit=(0.15, 1.0, 0.85), emit_str=2.0),
    'avt':          spec((0.055, 0.057, 0.062), 0.1, 0.55),       # автоматы и пускатели
    'avt-tog':      spec((0.72, 0.42, 0.02), 0.0, 0.40),          # рычажки взвода: оранжевые
    'plc':          spec((0.60, 0.61, 0.62), 0.15, 0.44),         # контроллер: светлый корпус
    'plc-lamp':     spec((0.10, 0.65, 0.30), 0.0, 0.20, emit=(0.2, 1.0, 0.4), emit_str=2.0),
    'klem':         spec((0.12, 0.30, 0.16), 0.0, 0.52),          # клеммы и каналы: зелёно-серый
    'hmi':          spec((0.10, 0.105, 0.115), 0.2, 0.42),        # панель оператора
    'hmi-screen':   spec((0.06, 0.28, 0.42), 0.0, 0.18, emit=(0.10, 0.70, 1.0), emit_str=1.8),
    'hmi-lamp':     spec((0.60, 0.30, 0.02), 0.0, 0.20, emit=(1.0, 0.55, 0.08), emit_str=2.2),
    'hmi-stop':     spec((0.60, 0.02, 0.02), 0.0, 0.30),          # грибок СТОП
    'vent':         spec((0.22, 0.23, 0.25), 0.3, 0.52),          # климат
    'vent-grid':    spec((0.16, 0.17, 0.19), 0.2, 0.58),
    'nozzle':       spec((0.36, 0.37, 0.39), 0.80, 0.38),         # передняя сопловая балка
    'spray':        spec((0.42, 0.44, 0.46), 0.55, 0.44),         # боковые и задние насадки
    'opora':        spec((0.36, 0.37, 0.39), 0.55, 0.48),         # подрамник и поворотный круг
    'strela':       spec((0.62, 0.30, 0.02), 0.0, 0.40),          # стрела: сигнальный жёлтый
    'lulka':        spec((0.60, 0.29, 0.02), 0.0, 0.44),          # люлька
    'lulka-pult':   spec((0.075, 0.078, 0.085), 0.2, 0.50),
    'autrig':       spec((0.30, 0.31, 0.33), 0.70, 0.44),         # аутригеры
    'pult':         spec((0.10, 0.105, 0.115), 0.2, 0.48),        # пульты и датчики
    'pult-lamp':    spec((0.10, 0.65, 0.30), 0.0, 0.20, emit=(0.2, 1.0, 0.4), emit_str=2.0),
    'pult-amber':   spec((0.75, 0.30, 0.02), 0.0, 0.25, emit=(1.0, 0.45, 0.05), emit_str=1.4),
    'hydro':        spec((0.26, 0.27, 0.30), 0.75, 0.42),
    'hose':         spec((0.020, 0.020, 0.022), 0.0, 0.80),
}
BEVELED = {'kabina', 'tank', 'hatch', 'shassi', 'boom', 'pump', 'hydro', 'fwing',
           'kabina-dark', 'kabina-chrome', 'reel', 'water', 'tank-dark', 'pump-dark', 'tank-panel', 'tank-stripe',
           'body', 'body-dark', 'bunker', 'press', 'eject', 'lift',
           'hopper', 'conveyor', 'plow', 'brush', 'brine',
           'rama', 'motor', 'mufta', 'val', 'ulitka', 'koleso', 'pipe', 'kip',
           'shkaf', 'dver', 'vvod', 'pch', 'avt', 'plc', 'klem', 'hmi', 'vent',
           'nozzle', 'spray',
           'opora', 'strela', 'lulka', 'autrig', 'pult'}

def make_material(name):
    s = MATS.get(name)
    if isinstance(s, str): s = MATS[s]
    if s is None: s = spec((0.5, 0.5, 0.5))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*s['color'], 1.0)
    bsdf.inputs['Metallic'].default_value = s['metallic']
    bsdf.inputs['Roughness'].default_value = s['rough']
    if s['coat']:
        bsdf.inputs['Coat Weight'].default_value = s['coat']
        bsdf.inputs['Coat Roughness'].default_value = 0.08
    if s['emit']:
        bsdf.inputs['Emission Color'].default_value = (*s['emit'], 1.0)
        bsdf.inputs['Emission Strength'].default_value = s['emit_str']
    if s['glass']:
        bsdf.inputs['Transmission Weight'].default_value = 1.0
        bsdf.inputs['IOR'].default_value = 1.45
    # Workbench-вьюпорт не читает ноды — дублируем в display-поля
    m.diffuse_color = (*s['color'], 1.0)
    m.metallic = s['metallic']
    m.roughness = s['rough']
    return m

# ---- сцена с нуля --------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def add_torus_bm(bm, R, t, M, mj=48, mn=14):
    ring = []
    for i in range(mj):
        u = 2 * pi * i / mj
        cu, su = cos(u), sin(u)
        col = []
        for j in range(mn):
            v = 2 * pi * j / mn
            r_ = R + t * cos(v)
            col.append(bm.verts.new(M @ Vector((r_ * cu, r_ * su, t * sin(v)))))
        ring.append(col)
    for i in range(mj):
        for j in range(mn):
            a = ring[i][j]; b = ring[(i + 1) % mj][j]
            c = ring[(i + 1) % mj][(j + 1) % mn]; d = ring[i][(j + 1) % mn]
            bm.faces.new((a, b, c, d))

prims = json.load(open(PRIMS_JSON))['prims']
canon = lambda n: MATS[n] if isinstance(MATS.get(n), str) else n   # ftyre→tyre

# позиции колёс: самый крупный цилиндр с материалом резины в каждом колесе —
# это внешняя шина. Собираем их центры ДО сборки, а сами колёсные примитивы
# потом пропускаем: их заменит донорский меш.
WHEEL_MATS = {'tyre', 'rim'}
wheel_at, wheel_r = [], 0.0
if WHEEL_GLB:
    tyres = [p for p in prims if p['s'] == 'cyl' and canon(p['mat']) == 'tyre']
    if tyres:
        wheel_r = max(p['r'] for p in tyres)
        wheel_at = [(C @ mat4(p['w'])).translation for p in tyres if abs(p['r'] - wheel_r) < 1e-6]
    print('ДОНОР-КОЛЕСО позиций: %d · радиус %.3f' % (len(wheel_at), wheel_r))

bms, tubes = {}, []
for p in prims:
    name = canon(p['mat'])
    if WHEEL_GLB and name in WHEEL_MATS:
        continue
    if p['s'] == 'tube':
        tubes.append((name, p))
        continue
    bm = bms.setdefault(name, bmesh.new())
    M = C @ mat4(p['w'])
    if p['s'] == 'box':
        d = p['d']
        T = M @ Matrix.Diagonal((d[0] / 2, d[1] / 2, d[2] / 2, 1.0))
        bmesh.ops.create_cube(bm, size=2.0, matrix=T)
    elif p['s'] == 'cyl':
        seg = max(12, min(64, int(p['seg'] * 2)))
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg,
                              radius1=p['r'], radius2=p['r'], depth=p['h'], matrix=M @ RXm90)
    elif p['s'] == 'frustum':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=48,
                              radius1=p['rb'], radius2=p['rt'], depth=p['h'], matrix=M @ RXm90)
    elif p['s'] == 'sphere':
        seg = max(16, min(48, int(p['seg'] * 2)))
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=p['r'], matrix=M)
    elif p['s'] == 'torus':
        add_torus_bm(bm, p['R'], p['t'], M)
    elif p['s'] == 'capsule':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=24,
                              radius1=p['r'], radius2=p['r'], depth=p['h'], matrix=M @ RXm90)
        for sgn in (1, -1):
            bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=p['r'],
                                      matrix=M @ Matrix.Translation((0, sgn * p['h'] / 2, 0)))

truck = []
for name, bm in bms.items():
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for f in me.polygons: f.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(make_material(name))
    scene.collection.objects.link(ob)
    truck.append(ob)
    if name in BEVELED:
        bv = ob.modifiers.new('Bevel', 'BEVEL')
        bv.width = 0.008; bv.segments = 2
        bv.limit_method = 'ANGLE'; bv.angle_limit = radians(45)
        bv.use_clamp_overlap = True

# рукава/РВД — кривые с bevel (уже сэмплированы в мировых точках)
for name, p in tubes:
    cu = bpy.data.curves.new('tube_' + name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    pts = p['pts']
    sp.points.add(len(pts) - 1)
    for i, (x, y, z) in enumerate(pts):
        v = C @ Vector((x, y, z))
        sp.points[i].co = (v.x, v.y, v.z, 1.0)
    cu.bevel_depth = p['r']; cu.bevel_resolution = 6
    cu.use_fill_caps = True
    ob = bpy.data.objects.new('tube_' + name, cu)
    ob.data.materials.append(bpy.data.materials.get(name) or make_material(name))
    scene.collection.objects.link(ob)
    truck.append(ob)

# smooth by angle на всех мешах
for ob in truck:
    if ob.type != 'MESH': continue
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
try:
    bpy.ops.object.shade_auto_smooth(angle=radians(35))
except Exception:
    try: bpy.ops.object.shade_smooth_by_angle(angle=radians(35))
    except Exception: bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action='DESELECT')

# ---- донорское колесо -----------------------------------------------------------
# Один меш, размноженный по позициям с ОБЩИМИ данными (obj.copy() делит mesh),
# поэтому десять колёс стоят почти даром. Колесо приходит нормализованным:
# диаметр 1.0, ось вдоль Y — остаётся масштаб и перенос.
wheel_objs = []
if WHEEL_GLB and wheel_at:
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=WHEEL_GLB)
    imported = [o for o in scene.objects if o not in before and o.type == 'MESH']
    base = imported[0]
    if base.parent:
        base.select_set(True); bpy.context.view_layer.objects.active = base
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        base.select_set(False)
    for o in scene.objects:
        if o not in before and o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    wmat = bpy.data.materials.get('tyre') or make_material('tyre')
    base.data.materials.clear(); base.data.materials.append(wmat)
    for f in base.data.polygons: f.use_smooth = True
    s = 2 * wheel_r
    for i, c in enumerate(wheel_at):
        o = base if i == 0 else base.copy()      # меш общий, копия почти бесплатна
        if i: scene.collection.objects.link(o)
        # Колесо с другого борта разворачиваем на 180° вокруг вертикали, а НЕ
        # отрицательным масштабом: минус в scale выворачивает нормали наизнанку.
        # Шина круглая, поэтому разворот по X не виден, а диск смотрит наружу.
        # донор вырезан с борта +Y, поэтому лицом наружу он стоит там как есть,
        # а на противоположном борту его надо развернуть
        R = Matrix.Rotation(pi, 4, 'Z') if c.y < 0 else Matrix.Identity(4)
        o.matrix_world = Matrix.Translation(c) @ R @ Matrix.Diagonal((s, s, s, 1.0))
        wheel_objs.append(o); truck.append(o)
    print('ДОНОР-КОЛЕСО поставлено: %d шт, диаметр %.2f м' % (len(wheel_objs), s))

# ---- донорская кабина -----------------------------------------------------------
# Двойную кривизну кузовных панелей примитивами не набрать — берём готовую кабину
# КамАЗ-55111 (Sketchfab, CC-BY, mamontnikita62), вырезанную tools/donor-cab.py.
# Посадка самокалибрующаяся: масштаб — по ширине материала «Kabina» (это кузовная
# панель, её габарит 2500 известен точно), высота — по крыше, длина — по носу.
DONOR_MATS = {
    'Kabina': 'kabina', 'Liuk': 'kabina', 'steklo': 'glass', 'SALON': 'kabina-dark',
    # OTRAZATELY у автора — не только катафоты, но и вся окантовка решётки с шильдом:
    # в янтарь её красить нельзя, иначе морда уходит в жёлтый. Это кузовная панель.
    'fara': 'kabina-lamp', 'OTRAZATELY': 'kabina', 'lighttut02': 'kabina-amber',
    'disk': 'kabina-dark', 'rama': 'shassi', 'final1234': 'kabina-dark',
}

def mat_bbox(objs, want):
    lo = [1e18] * 3; hi = [-1e18] * 3
    for ob in objs:
        if ob.type != 'MESH': continue
        names = [m.name if m else '' for m in ob.data.materials]
        for p in ob.data.polygons:
            if p.material_index >= len(names) or names[p.material_index] != want: continue
            w = ob.matrix_world @ p.center
            for i in range(3):
                lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
    return lo, hi

def obj_bbox(objs):
    lo = [1e18] * 3; hi = [-1e18] * 3
    for ob in objs:
        if ob.type != 'MESH': continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
    return lo, hi

if CAB_GLB:
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=CAB_GLB)
    donor = [o for o in scene.objects if o not in before]
    roots = [o for o in donor if o.parent not in donor]

    # Считаем матрицу посадки аналитически и вжигаем её в matrix_world корней.
    # Через временный pivot нельзя: при его удалении дети теряют родительский
    # трансформ и схлопываются обратно в исходные координаты донора.
    R = Matrix.Rotation(radians(CAB_ROTZ), 4, 'Z')
    klo, khi = mat_bbox(donor, 'Kabina')       # кузовная панель: её ширина = габарит 2500
    olo, ohi = obj_bbox(donor)
    k = CAB_WIDTH / max(khi[1] - klo[1], 1e-9)
    S = Matrix.Diagonal((k, k, k, 1.0))
    SR = S @ R
    # прогоняем угловые точки через SR, чтобы узнать, куда уехали нос/крыша/центр
    def thru(lo, hi):
        pts = [SR @ Vector((x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
        return ([min(p[i] for p in pts) for i in range(3)],
                [max(p[i] for p in pts) for i in range(3)])
    klo2, khi2 = thru(klo, khi)
    olo2, ohi2 = thru(olo, ohi)
    T = Matrix.Translation((CAB_NOSE - ohi2[0],                 # нос (бампер) — вперёд
                            -(olo2[1] + ohi2[1]) / 2,           # по центру ширины
                            CAB_ROOF - khi2[2]))                # крыша — на заданную высоту
    M = T @ SR
    for o in roots:
        o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()
    print('ДОНОР масштаб %.6g · кабина Д%.2f Ш%.2f В%.2f м' %
          (k, khi2[0] - klo2[0], khi2[1] - klo2[1], khi2[2] - klo2[2]))

    for o in donor:
        if o.type != 'MESH': continue
        # чужие материалы → наша палитра (по имени слота автора)
        for i, m in enumerate(o.data.materials):
            tgt = DONOR_MATS.get(m.name if m else '', 'kabina-dark')
            o.data.materials[i] = bpy.data.materials.get(tgt) or make_material(tgt)
        if CAB_CUT > -1e8 or CAB_TOP < 1e8 or CAB_REAR > -1e8:
            mw = o.matrix_world
            bm = bmesh.new(); bm.from_mesh(o.data)
            bad = []
            for f in bm.faces:
                w = mw @ f.calc_center_median()
                # низ: обрубок донорской рамы позади бампера лезет в насосный отсек
                if w.z < CAB_CUT and w.x < CAB_CUT_X: bad.append(f)
                # верх: у донора над крышей своя выхлопная труба, у нас глушитель под рамой
                elif w.z > CAB_TOP: bad.append(f)
                # корма: выхлопной стояк донора стоит за задней стенкой и лезет в надстройку
                elif w.x < CAB_REAR: bad.append(f)
            bmesh.ops.delete(bm, geom=bad, context='FACES')
            bm.to_mesh(o.data); bm.free()
        for f in o.data.polygons: f.use_smooth = True
        truck.append(o)
    lo3, hi3 = obj_bbox(donor)
    print('ДОНОР мешей: %d · в машине X[%.2f..%.2f] Y[%.2f..%.2f] Z[%.2f..%.2f]'
          % (sum(1 for o in donor if o.type == 'MESH'), lo3[0], hi3[0], lo3[1], hi3[1], lo3[2], hi3[2]))

    if EXPORT_CAB:
        bpy.ops.object.select_all(action='DESELECT')
        for o in donor:
            if o.type != 'MESH': continue
            o.select_set(True); bpy.context.view_layer.objects.active = o
            if CAB_TRIS:
                n = sum(len(p.vertices) - 2 for p in o.data.polygons)
                if n > CAB_TRIS:
                    d = o.modifiers.new('Dec', 'DECIMATE')
                    d.decimate_type = 'COLLAPSE'; d.ratio = CAB_TRIS / n
                    bpy.ops.object.modifier_apply(modifier=d.name)
            o.data.materials.clear()          # голограмма красит сама, чужие материалы — мёртвый груз
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
                   for o in donor if o.type == 'MESH')
        # экспорт glTF сам вернёт Z-up обратно в Y-up — это ровно наши модельные координаты
        bpy.ops.export_scene.gltf(filepath=EXPORT_CAB, export_format='GLB', use_selection=True,
                                  export_materials='NONE', export_apply=True)
        print('CAB EXPORTED %s · треугольников %d' % (EXPORT_CAB, tris))
        sys.exit(0)

# ---- выгрузка подмножества систем в GLB (для parts-режима движка) ---------------
# Нужна, чтобы в part00 «Шасси и ходовая» уехали донорские колёса: decl-to-glb
# знает только про примитивы и о донорском меше ничего не знает.
if EXPORT_GLB:
    bpy.ops.object.select_all(action='DESELECT')
    n = 0
    for ob in truck:
        if ob.type != 'MESH': continue
        mats = [m.name for m in ob.data.materials if m]
        if EXPORT_MATS and not any(mn.startswith(p) for mn in mats for p in EXPORT_MATS):
            continue
        ob.select_set(True); n += 1
    if not n:
        print('НЕЧЕГО ВЫГРУЖАТЬ: ни один материал не совпал с', EXPORT_MATS); sys.exit(1)
    bpy.ops.export_scene.gltf(filepath=EXPORT_GLB, export_format='GLB', use_selection=True,
                              export_materials='NONE', export_apply=True)
    print('EXPORTED %s · мешей %d' % (EXPORT_GLB, n))
    sys.exit(0)

# ---- окружение: пол-студия ------------------------------------------------------
def flat_mat(name, color, rough=0.8, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    m.diffuse_color = (*color, 1.0); m.roughness = rough; m.metallic = metallic
    return m

def ground():
    me = bpy.data.meshes.new('ground')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=140)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('ground', me)
    ob.data.materials.append(flat_mat('ground', (0.50, 0.51, 0.53), 0.88))
    scene.collection.objects.link(ob)
ground()

# люк-колодец под наконечником рукава (движ. x=-4.8 → бленд (-4.8, 0)):
# дыра-диск, чугунная горловина и сдвинутая крышка — мотивация позы рукава
def manhole(x=-4.80, y=0.0):
    hole = bpy.data.meshes.new('manhole_hole')
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.36, radius2=0.36, depth=0.02,
                          matrix=Matrix.Translation((x, y, 0.011)))
    bm.to_mesh(hole); bm.free()
    ob = bpy.data.objects.new('manhole_hole', hole)
    ob.data.materials.append(flat_mat('manhole_dark', (0.008, 0.008, 0.009), 0.95))
    scene.collection.objects.link(ob)

    iron = flat_mat('manhole_iron', (0.055, 0.056, 0.06), 0.55, 0.4)
    ring = bpy.data.meshes.new('manhole_ring')
    bm = bmesh.new()
    add_torus_bm(bm, 0.42, 0.045, Matrix.Translation((x, y, 0.03)), mj=48, mn=12)
    # крышка рядом, прислонена плашмя со сдвигом
    bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.36, radius2=0.36, depth=0.04,
                          matrix=Matrix.Translation((x - 0.95, y + 0.55, 0.025)) @ Matrix.Rotation(radians(4), 4, 'Y'))
    add_torus_bm(bm, 0.30, 0.018, Matrix.Translation((x - 0.95, y + 0.55, 0.05)) @ Matrix.Rotation(radians(4), 4, 'Y'), mj=36, mn=8)
    bm.to_mesh(ring); bm.free()
    ob = bpy.data.objects.new('manhole_ring', ring)
    ob.data.materials.append(iron)
    for f in ring.polygons: f.use_smooth = True
    scene.collection.objects.link(ob)

    # продолжение рукава: из наконечника вниз, сквозь горловину в колодец
    ext = bpy.data.meshes.new('hose_ext')
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.10, radius2=0.10, depth=0.62,
                          matrix=Matrix.Translation((x, y, 0.16)))
    bm.to_mesh(ext); bm.free()
    for f in ext.polygons: f.use_smooth = True
    ob = bpy.data.objects.new('hose_ext', ext)
    ob.data.materials.append(bpy.data.materials.get('hose') or flat_mat('hose', (0.02, 0.02, 0.022), 0.8))
    scene.collection.objects.link(ob)

# колодец рисуем только под машины: у стенда оборудования ему взяться неоткуда
if CAMS in ('truck', 'cab'):
    manhole()

world = bpy.data.worlds.new('studio')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.84, 0.87, 0.91, 1)
bg.inputs['Strength'].default_value = 0.75

def lamp(name, kind, loc, energy, size=None, rot=None, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy; ld.color = color
    if size and kind == 'AREA': ld.size = size
    if kind == 'SUN': ld.angle = radians(6)
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    if rot: ob.rotation_euler = rot
    scene.collection.objects.link(ob)
    return ob

def aim(ob, target):
    em = bpy.data.objects.new(ob.name + '_tgt', None)
    em.location = target
    scene.collection.objects.link(em)
    tc = ob.constraints.new('TRACK_TO')
    tc.target = em; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'

sun = lamp('sun', 'SUN', (14, -10, 16), 3.2, color=(1.0, 0.96, 0.90)); aim(sun, (0, 0, 1))
key = lamp('key', 'AREA', (9, -9, 8), 2200, size=9); aim(key, (0.5, 0, 1.6))
fill = lamp('fill', 'AREA', (-7, 9, 6), 900, size=11, color=(0.92, 0.95, 1.0)); aim(fill, (0, 0, 1.6))
rim = lamp('rim', 'AREA', (-12, -6, 5), 1200, size=6); aim(rim, (-1, 0, 2))

# ---- камеры ---------------------------------------------------------------------
def camera(name, loc, target, focal=40):
    cd = bpy.data.cameras.new(name)
    cd.lens = focal
    ob = bpy.data.objects.new(name, cd)
    ob.location = loc
    scene.collection.objects.link(ob)
    aim(ob, target)
    return ob

def unit_cams():
    lo, hi = obj_bbox(truck)
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    s = [hi[i] - lo[i] for i in range(3)]
    d = max(s) * 2.6 + 1.0
    return [
        camera('unit34',   (c[0] + d * 0.62, c[1] - d * 0.62, c[2] + s[2] * 0.30), c, 45),
        camera('unitside', (c[0], c[1] - d * 1.10, c[2]), c, 50),
        camera('unitfront', (c[0] + d * 1.15, c[1] - d * 0.05, c[2]), c, 50),
        camera('unittop',  (c[0] + d * 0.50, c[1] - d * 0.50, c[2] + d * 0.62), c, 42),
    ]

CAM_SETS = {
    'truck': lambda: [
        camera('front34', (10.8, -7.6, 3.6), (0.25, 0.1, 1.55), 42),   # как на фото КО-512
        camera('rear34',  (-10.2, 7.2, 4.0), (-0.7, -0.1, 1.75), 42),  # корма: крышка, стрела, рукав
        camera('side',    (-0.3, -16.5, 1.9), (-0.3, 0, 1.75), 58),    # сверка с заводским чертежом
        camera('detail',  (8.2, -5.2, 2.1), (2.7, 0.7, 0.9), 48),      # нос и переднее колесо крупно
    ],
    # стенд кабины: ракурс 1-в-1 с заводским фото КО-512 + три ортогональных сверки
    'cab': lambda: [
        camera('cab34',   (13.4, -8.2, 3.9), (3.05, -0.1, 2.15), 80),  # как на фото: низкий 3/4 спереди
        camera('cabfront', (16.0, 0, 2.30),  (2.95, 0, 2.30), 95),     # фас: решётка, шильд, фары
        camera('cabside', (2.95, -15.0, 2.20), (2.95, 0, 2.20), 95),   # профиль: дверь, стойки, крыша
        camera('cabtop',  (9.6, -5.4, 8.4),  (3.0, 0, 2.1), 55),       # сверху-спереди: скруглённость
    ],
    # стенд оборудования: камеры САМОНАВОДЯТСЯ по габариту модели, поэтому
    # одинаково годятся и для лежачего агрегата, и для стоячего шкафа
    'unit': lambda: unit_cams(),
}
cams = CAM_SETS[CAMS]()

# ---- рендер ---------------------------------------------------------------------
def try_gpu():
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for backend in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = backend
                prefs.get_devices()
                gpus = [d for d in prefs.devices if d.type == backend]
                if gpus:
                    for d in prefs.devices: d.use = (d.type == backend or d.type == 'CPU')
                    scene.cycles.device = 'GPU'
                    print('CYCLES GPU:', backend, [d.name for d in gpus])
                    return True
            except Exception as e:
                print('gpu backend fail', backend, e)
    except Exception as e:
        print('no cycles prefs', e)
    return False

scene.render.image_settings.file_format = 'PNG'
if MODE == 'quick':
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.show_shadows = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
else:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 160 if MODE == 'final' else 48
    scene.cycles.use_denoising = True
    if not try_gpu():
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 96 if MODE == 'final' else 32
        print('CYCLES CPU fallback')
    if MODE == 'final':
        scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    else:
        scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    try:
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'AgX - Punchy'
    except Exception:
        pass

for cam in cams:
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT_DIR, f'{MODE}_{cam.name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)

if BLEND_OUT:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT, compress=True)
    print('SAVED', BLEND_OUT)
print('ALL DONE')
