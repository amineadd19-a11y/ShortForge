import { spawn } from 'node:child_process';

function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',c=>out+=c);p.stderr.on('data',c=>err+=c);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(`${command} failed (${code}): ${err.slice(-1500)}`)));});}

export async function detectFaces(input,start,duration){
  if(process.env.ENABLE_FACE_TRACKING!=='true') return {enabled:false,tracks:[]};
  // OpenCV is intentionally optional. If unavailable, the renderer can safely fall back to center crop.
  try {
    const out=await run('python3',['-c',`import cv2,json
p=${JSON.stringify(input)}; cap=cv2.VideoCapture(p); fps=cap.get(cv2.CAP_PROP_FPS) or 30; start=${Number(start)||0}; dur=${Number(duration)||0}; cap.set(cv2.CAP_PROP_POS_MSEC,start*1000); end=start+dur; face=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml'); rows=[]
while cap.isOpened() and cap.get(cv2.CAP_PROP_POS_MSEC)/1000<end:
 ok,frame=cap.read()
 if not ok: break
 t=cap.get(cv2.CAP_PROP_POS_MSEC)/1000
 if int(t*2)%2: continue
 g=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
 fs=face.detectMultiScale(g,1.1,5,minSize=(60,60))
 if len(fs):
  x,y,w,h=max(fs,key=lambda r:r[2]*r[3]); rows.append({'time':t,'x':(x+w/2)/frame.shape[1],'y':(y+h/2)/frame.shape[0],'confidence':min(1,(w*h)/(frame.shape[1]*frame.shape[0])*20)})
cap.release(); print(json.dumps(rows))`]);
    return {enabled:true,tracks:JSON.parse(out.trim()||'[]')};
  } catch { return {enabled:false,tracks:[],fallback:'center'}; }
}
` }