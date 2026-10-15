#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  🎨 فحص كتالوج الأصول (Assets.xcassets) — يكشف خطأً يُسقط ترجمة أبل
# ════════════════════════════════════════════════════════════════════════
#  لماذا هذا الملف موجود؟
#     في نسخة v2.9 أُضيفت صورتا الخلفية (AppBackgroundDay/Night) وكُتبت
#     قيمة المقياس خطأً «2xx» و«3xx» بدل «2x» و«3x».
#        • كل الفحوصات المحلية مرّت (لا أحد يقرأ Contents.json).
#        • والمترجم على السيرفر لم يبدأ عمل — التنفيذ سقط في تصريف الأصول
#          (actool) فأحمرّ سيرا «فحص الترجمة» و«اللقطات» معًا.
#     هذا الفحص يقرأ كل Contents.json في الكتالوج فيثبّت:
#        ① JSON صالح ② قيم idiom/scale من القائمة المسموحة
#        ③ كل ملف مُشار إليه موجود فعلًا ④ لا ملفات يتيمة
#        ⑤ ملفات الصور فعلًا صور (بصمة JPEG/PNG)
#
#  الاستخدام:   python3 tests/assets-check.py
# ════════════════════════════════════════════════════════════════════════
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOGS = sorted(ROOT.glob("**/Assets.xcassets"))

OK_IDIOMS = {"universal", "watch", "iphone", "ipad", "mac", "tv", "ios-marketing", "car"}
OK_SCALES = {"1x", "2x", "3x"}
OK_ROLES = {"primary", "preview", "tinted", "notification", "companion-settings", "companion-widget", "quick-look"}

IMG_MAGIC = {
    b"\xff\xd8\xff": "JPEG",
    b"\x89PNG\r\n\x1a\n": "PNG",
    b"GIF8": "GIF",
}

passed = 0
problems = []


def check(cond, msg):
    global passed
    if cond:
        passed += 1
    else:
        problems.append(msg)


if not CATALOGS:
    print("  ⚠️ لا كتالوج أصول في المشروع — لا شيء لفحصه")
    sys.exit(0)

for cat in CATALOGS:
    check((cat / "Contents.json").exists(), f"{cat.relative_to(ROOT)}: جذر الكتالوج بلا Contents.json")

    for folder in sorted(p for p in cat.iterdir() if p.is_dir()):
        contents = folder / "Contents.json"
        rel = folder.relative_to(ROOT)
        check(contents.exists(), f"{rel}: مجلد بلا Contents.json")
        if not contents.exists():
            continue

        try:
            data = json.loads(contents.read_text(encoding="utf-8"))
            check(True, "")
        except Exception as exc:                       # noqa: BLE001
            problems.append(f"{rel}/Contents.json: JSON غير صالح — {exc}")
            continue

        check(isinstance(data.get("info"), dict) and data["info"].get("version") == 1,
              f"{rel}/Contents.json: مفتاح info/version ناقص أو خطأ")

        used = set()
        for img in data.get("images", []) or []:
            scale, idiom, fname = img.get("scale"), img.get("idiom"), img.get("filename")
            role = img.get("role")
            if scale is not None:                      # ← الخطأ الذي أوقف سير أبل
                check(scale in OK_SCALES,
                      f'{rel}/Contents.json: قيمة scale غير صالحة "{scale}" — الصحيح 1x أو 2x أو 3x')
            if idiom is not None:
                check(idiom in OK_IDIOMS, f'{rel}/Contents.json: idiom غير متعارف عليه "{idiom}"')
            if role is not None:
                check(role in OK_ROLES, f'{rel}/Contents.json: role غير متعارف عليه "{role}"')
            if fname:
                used.add(fname)
                check((folder / fname).exists(),
                      f"{rel}/Contents.json: الملف المُشار إليه مفقود — {fname}")

        # ⑤ الملفات اليتيمة: صورة مكتوبة على القرص وغير مذكورة في Contents.json
        for f in sorted(folder.iterdir()):
            if f.name == "Contents.json" or f.is_dir():
                continue
            check(f.name in used, f"{rel}: ملف غير مُدرَج في Contents.json — {f.name}")
            head = f.open("rb").read(8)
            kind = next((k for m, k in IMG_MAGIC.items() if head.startswith(m)), None)
            check(kind is not None, f"{rel}/{f.name}: بصمة الملف ليست صورة معروفة (JPEG/PNG/GIF)")
            if kind == "JPEG":
                check(f.suffix.lower() in (".jpg", ".jpeg"),
                      f"{rel}/{f.name}: بيانات JPEG في ملف بامتداد {f.suffix}")
            if kind == "PNG":
                check(f.suffix.lower() == ".png", f"{rel}/{f.name}: بيانات PNG في ملف بامتداد {f.suffix}")

print("  ── أصول المشروع ──")
for cat in CATALOGS:
    sets = len([p for p in cat.iterdir() if p.is_dir() and p.suffix == ".imageset"])
    apps = len([p for p in cat.iterdir() if p.is_dir() and p.suffix == ".appiconset"])
    print(f"  📁 {cat.relative_to(ROOT)}: {sets} مجموعة صور · {apps} أيقونة تطبيق")

if problems:
    print()
    for msg in problems:
        print(f"   ✘ {msg}")
    print(f"\n📊 النتيجة: {passed} ✔ · {len(problems)} ✘")
    sys.exit(1)

print(f"\n📊 النتيجة: ✔ الكتالوج سليم ({passed} فحصًا)")
