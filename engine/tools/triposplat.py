# TripoSplat (нативный в ComfyUI 0.23+) — картинка → 3D gaussian splat (.ply).
# Параметры взяты из штатного блюпринта «Image to Gaussian Splat (TripoSplat)».
#   python tools/triposplat.py <image> <out_prefix> [num_gaussians] [steps] [seed] [--no-invert]
import json, sys, time, urllib.request, os, uuid

COMFY = 'http://127.0.0.1:8188'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
NO_INVERT = '--no-invert' in sys.argv
img_path, prefix = args[0], args[1]
NUM_G = int(args[2]) if len(args) > 2 else 262144
STEPS = int(args[3]) if len(args) > 3 else 20
SEED  = int(args[4]) if len(args) > 4 else 46
FRAMES = int(args[5]) if len(args) > 5 else 6   # кадров облёта для проверки

def api(path, data=None):
    req = urllib.request.Request(COMFY + path, data=data,
        headers={'Content-Type': 'application/json'} if data else {})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

# upload
bnd = uuid.uuid4().hex
name = os.path.basename(img_path)
with open(img_path, 'rb') as f: blob = f.read()
body = (('--%s\r\nContent-Disposition: form-data; name="image"; filename="%s"\r\n'
         'Content-Type: image/png\r\n\r\n') % (bnd, name)).encode() + blob + ('\r\n--%s--\r\n' % bnd).encode()
req = urllib.request.Request(COMFY + '/upload/image', data=body,
    headers={'Content-Type': 'multipart/form-data; boundary=' + bnd})
img_name = json.loads(urllib.request.urlopen(req, timeout=180).read())['name']
print('uploaded:', img_name, flush=True)

mask_src = ["4", 0] if not NO_INVERT else ["3", 0]
g = {
 "1":  {"class_type":"LoadImage","inputs":{"image":img_name}},
 "2":  {"class_type":"LoadBackgroundRemovalModel","inputs":{"bg_removal_name":"birefnet.safetensors"}},
 "3":  {"class_type":"RemoveBackground","inputs":{"bg_removal_model":["2",0],"image":["1",0]}},
 "4":  {"class_type":"InvertMask","inputs":{"mask":["3",0]}},
 "5":  {"class_type":"TripoSplatPreprocessImage","inputs":{"image":["1",0],"mask":mask_src,"erode_radius":1,"size":1024}},
 "6":  {"class_type":"CLIPVisionLoader","inputs":{"clip_name":"dino_v3_vit_h.safetensors"}},
 "7":  {"class_type":"VAELoader","inputs":{"vae_name":"flux2-vae.safetensors"}},
 "8":  {"class_type":"TripoSplatConditioning","inputs":{"clip_vision":["6",0],"vae":["7",0],"image":["5",0]}},
 "9":  {"class_type":"UNETLoader","inputs":{"unet_name":"triposplat_fp16.safetensors","weight_dtype":"default"}},
 "10": {"class_type":"KSampler","inputs":{"model":["9",0],"seed":SEED,"steps":STEPS,"cfg":3.0,
         "sampler_name":"dpmpp_2m","scheduler":"simple","positive":["8",0],"negative":["8",1],
         "latent_image":["8",2],"denoise":1.0}},
 "11": {"class_type":"VAELoader","inputs":{"vae_name":"triposplat_vae_decoder_fp16.safetensors"}},
 "12": {"class_type":"VAEDecodeTripoSplat","inputs":{"samples":["10",0],"vae":["11",0],
         "num_gaussians":NUM_G,"seed":0}},
 "13": {"class_type":"SplatToFile3D","inputs":{"splat":["12",0],"format":"ply"}},
 "14": {"class_type":"SaveGLB","inputs":{"mesh":["13",0],"filename_prefix":prefix}},
 # орбита для визуальной проверки (frames>1 = облёт)
 "15": {"class_type":"RenderSplat","inputs":{"splat":["12",0],"width":768,"height":768,
         "frames":FRAMES,"splat_scale":1.0,"sharpen":2.0,"headlight_shading":0.0,
         "opacity_threshold":0.0,"render_style":"color","background":"#20242b"}},
 "16": {"class_type":"SaveImage","inputs":{"images":["15",0],"filename_prefix":prefix+"_view"}},
}
q = api('/prompt', json.dumps({"prompt": g}).encode())
pid = q.get('prompt_id')
print('queued:', pid, flush=True)
if not pid:
    print('ERROR', json.dumps(q)[:2000]); sys.exit(1)

t0 = time.time()
while True:
    time.sleep(8)
    try: hist = api('/history/' + pid)
    except Exception as e:
        print('poll err', e, flush=True); continue
    if pid in hist:
        st = hist[pid].get('status', {})
        if st.get('completed') or st.get('status_str') == 'success':
            print('DONE in %.0fs' % (time.time() - t0), flush=True)
            for nid, out in hist[pid].get('outputs', {}).items():
                for k, items in out.items():
                    for it in (items or []):
                        if isinstance(it, dict) and it.get('filename'):
                            print('OUT:', it.get('subfolder', ''), it['filename'], flush=True)
            break
        if st.get('status_str') == 'error':
            print('FAILED:', json.dumps(st)[:3000], flush=True); sys.exit(1)
    print('... %.0fs' % (time.time() - t0), flush=True)
