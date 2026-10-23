# منصة توثيق الأضرار العقارية

منصة لرفع بلاغات الأضرار (موقع + وصف + صور)، تقييم أولي بـ YOLOv8، مراجعة المشرف، خريطة تفاعلية، وتوزيع المساعدات.

## المتطلبات

- Node.js 20+ للتطوير المحلي
- Docker لتشغيل المنصة كاملة أو رفعها
- Python 3.10+ للتدريب على الجهاز. داخل صورة Docker يوجد Python، والتقييم وقت التشغيل يحمّل ملف ONNX من نفس الحاوية

## التشغيل بـ Docker

حاوية واحدة فيها PostgreSQL/PostGIS والـ API والواجهة وPython. ملف البناء في جذر المستودع: `Dockerfile`.

```bash
cp .env.example .env
# غيّر كلمات المرور والأسرار في .env قبل أي رفع عام

docker compose up -d --build
```

- الواجهة: http://localhost:8080  
- فحص الـ API عبر الواجهة: http://localhost:8080/api/health  

`WEB_ORIGIN` لازم يطابق عنوان المتصفح تماماً. خلف HTTPS اجعل `COOKIE_SECURE=true`.

ضع نموذج التقييم في `ml/weights/peccd-yolov8n.onnx` قبل التشغيل. الحاوية تركّبه على `/models`. بدونه تشتغل المنصة ويظهر أن التقييم غير متاح. تدريب النموذج يبقى بـ `npm run vision:train` على الجهاز، لأن PyTorch لا يُثبَّت داخل صورة الرفع.

على Render مسار البناء هو `Dockerfile`. اترك `PORT` فاضي، واضبط `WEB_ORIGIN` على رابط `https://...onrender.com` و`COOKIE_SECURE=true`.

نوم Render يمسح قرص الحاوية، لذلك قاعدة البيانات تكون على Neon والصور على Cloudinary:

- `DATABASE_URL`: رابط الاتصال من Neon، وفيه `sslmode=require`.
- `CLOUDINARY_URL`: من لوحة Cloudinary، بالشكل `cloudinary://api_key:api_secret@cloud_name`.

بدون هذين المتغيرين الحاوية تشغّل Postgres محلياً وتحفظ الصور على القرص، وهما يختفيان عندما تنام الخدمة.

عند إقلاع الحاوية يتم تلقائياً: تهجير الجداول، إنشاء المشرف من `BOOTSTRAP_SUPERVISOR_EMAIL`، ثم بذر حساب المواطن والمنظمة وبلاغات العرض. إذا لم تكن صور التدريب داخل الصورة تُنشأ البلاغات بلا صور.

## التشغيل المحلي

يستخدم PostgreSQL من `apps/api/.env` (المنصة المحلية على المنفذ 5433، أو أي خادم آخر).

```bash
# 1) إعداد الـ API
cp apps/api/.env.example apps/api/.env
# عدّل الأسرار وكلمة مرور المشرف إن لزم

# 2) التثبيت والتهجير
npm install
npm run db:migrate

# 3) بيانات عرض (منظمة + مواطن + بلاغات بصور)
npm run db:seed

# 4) التشغيل
npm run dev
```

- الواجهة: http://localhost:5173  
- الـ API: http://localhost:3000/api/health  

حسابات العرض بعد `npm run db:seed`:

| الدور | البريد | كلمة المرور |
|--------|--------|-------------|
| مشرف | قيمة `BOOTSTRAP_SUPERVISOR_EMAIL` | قيمة `BOOTSTRAP_SUPERVISOR_PASSWORD` |
| مواطن | `citizen@damage.local` | `Demo1234!` (أو `SEED_PASSWORD`) |
| منظمة | `org@damage.local` | نفس كلمة مرور المواطن |

نموذج الرؤية: `ml/weights/peccd-yolov8n.onnx` (مساره في `VISION_MODEL_PATH`). بعد البذر افتح بلاغاً واضغط «تقييم الصور» لتحميل النتائج على الصور.

## تدريب النموذج (اختياري)

```bash
npm run vision:prepare
npm run vision:train
```

الناتج يُنسخ تلقائياً إلى `ml/weights/peccd-yolov8n.onnx`.

## البنية

- `apps/web` — React + Vite + Leaflet، تُخدم من nginx داخل الحاوية  
- `apps/api` — NestJS + Prisma + ONNX Runtime، على المنفذ الداخلي 3000  
- `packages/shared` — مخططات Zod والأدوار وتجميع كشف الضرر  
- `ml/` — بيانات PECCD وسكربت التدريب `train.py`  
- `Dockerfile` — صورة واحدة: قاعدة البيانات + API + الواجهة + Python  
- `docs/uml/` — مخططات ERD و Use Case  
