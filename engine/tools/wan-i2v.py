# Wan 2.2 i2v 14B (fp8, BlinkBang-LoRA) через ComfyUI HTTP API — локальное
# оживление кадра (image-to-video) для брифинг-роликов.
#   python tools/wan-i2v.py <image> <prompt> <out_prefix> [W H length steps]
# Дефолт 832x480, 81 кадр (5с @16fps), 4 шага. ВАЖНО: 4 шага мылят тонкие
# неоновые линии голограммы — для наших кадров нужен steps=10 при 960x544
# (~5 мин на RTX 5080). Результат: D:/ComfyUI_cu128_50XX/ComfyUI/output/.
import json, sys, time, urllib.request, urllib.parse, os, uuid

COMFY='http://127.0.0.1:8188'
img_path, prompt, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
W  = int(sys.argv[4]) if len(sys.argv)>4 else 832
H  = int(sys.argv[5]) if len(sys.argv)>5 else 480
L  = int(sys.argv[6]) if len(sys.argv)>6 else 81   # 81 кадр @16fps = 5с
ST = int(sys.argv[7]) if len(sys.argv)>7 else 4    # общее число шагов (делится 50/50 high/low)

def api(path, data=None, raw=False):
    req=urllib.request.Request(COMFY+path, data=data,
        headers={'Content-Type':'application/json'} if data else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if raw else json.loads(r.read())

# 1) upload image (multipart)
bnd=uuid.uuid4().hex
name=os.path.basename(img_path)
with open(img_path,'rb') as f: blob=f.read()
body=(('--%s\r\nContent-Disposition: form-data; name="image"; filename="%s"\r\n'
       'Content-Type: image/jpeg\r\n\r\n')%(bnd,name)).encode()+blob+('\r\n--%s--\r\n'%bnd).encode()
req=urllib.request.Request(COMFY+'/upload/image', data=body,
    headers={'Content-Type':'multipart/form-data; boundary='+bnd})
up=json.loads(urllib.request.urlopen(req, timeout=120).read())
img_name=up['name']
print('uploaded:', img_name, flush=True)

NEG='static image, frozen, no motion, blurry, low quality, text, watermark, captions, subtitles, extra buildings, deformed structure'
g={
 "1": {"class_type":"UNETLoader","inputs":{"unet_name":"wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors","weight_dtype":"default"}},
 "2": {"class_type":"UNETLoader","inputs":{"unet_name":"wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors","weight_dtype":"default"}},
 "3": {"class_type":"LoraLoaderModelOnly","inputs":{"model":["1",0],"lora_name":"I2V-WAN2.2-BlinkBang-HighNoise-000050.safetensors","strength_model":1.0}},
 "4": {"class_type":"LoraLoaderModelOnly","inputs":{"model":["2",0],"lora_name":"I2V-WAN2.2-BlinkBang-LowNoise-000040.safetensors","strength_model":1.0}},
 "5": {"class_type":"ModelSamplingSD3","inputs":{"model":["3",0],"shift":5.0}},
 "6": {"class_type":"ModelSamplingSD3","inputs":{"model":["4",0],"shift":5.0}},
 "7": {"class_type":"CLIPLoader","inputs":{"clip_name":"umt5_xxl_fp8_e4m3fn_scaled.safetensors","type":"wan","device":"default"}},
 "8": {"class_type":"CLIPTextEncode","inputs":{"clip":["7",0],"text":prompt}},
 "9": {"class_type":"CLIPTextEncode","inputs":{"clip":["7",0],"text":NEG}},
 "10":{"class_type":"VAELoader","inputs":{"vae_name":"wan_2.1_vae.safetensors"}},
 "11":{"class_type":"LoadImage","inputs":{"image":img_name}},
 "12":{"class_type":"WanImageToVideo","inputs":{"positive":["8",0],"negative":["9",0],"vae":["10",0],
        "width":W,"height":H,"length":L,"batch_size":1,"start_image":["11",0]}},
 "13":{"class_type":"KSamplerAdvanced","inputs":{"model":["5",0],"add_noise":"enable","noise_seed":7,
        "steps":ST,"cfg":1.0,"sampler_name":"euler","scheduler":"simple",
        "positive":["12",0],"negative":["12",1],"latent_image":["12",2],
        "start_at_step":0,"end_at_step":ST//2,"return_with_leftover_noise":"enable"}},
 "14":{"class_type":"KSamplerAdvanced","inputs":{"model":["6",0],"add_noise":"disable","noise_seed":7,
        "steps":ST,"cfg":1.0,"sampler_name":"euler","scheduler":"simple",
        "positive":["12",0],"negative":["12",1],"latent_image":["13",0],
        "start_at_step":ST//2,"end_at_step":ST,"return_with_leftover_noise":"disable"}},
 "15":{"class_type":"VAEDecode","inputs":{"samples":["14",0],"vae":["10",0]}},
 "16":{"class_type":"CreateVideo","inputs":{"images":["15",0],"fps":16}},
 "17":{"class_type":"SaveVideo","inputs":{"video":["16",0],"filename_prefix":prefix,"format":"mp4","codec":"h264"}},
}
q=api('/prompt', json.dumps({"prompt":g}).encode())
pid=q.get('prompt_id')
print('queued:', pid, flush=True)
if not pid:
    print('ERROR', q); sys.exit(1)

t0=time.time()
while True:
    time.sleep(10)
    try: hist=api('/history/'+pid)
    except Exception as e: print('poll err', e, flush=True); continue
    if pid in hist:
        st=hist[pid].get('status',{})
        if st.get('completed') or st.get('status_str')=='success':
            print('DONE in %.0fs'%(time.time()-t0), flush=True)
            for nid,out in hist[pid].get('outputs',{}).items():
                for k in ('images','video','gifs'):
                    for it in out.get(k,[]) or []:
                        print('OUT:', it.get('subfolder',''), it.get('filename'), flush=True)
            break
        if st.get('status_str')=='error':
            print('FAILED:', json.dumps(st)[:2000], flush=True); sys.exit(1)
    print('... %.0fs'%(time.time()-t0), flush=True)
