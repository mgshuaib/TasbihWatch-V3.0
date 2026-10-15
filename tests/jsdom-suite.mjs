/**
 * ════════════════════════════════════════════════════════════════════════
 *  سبحة — حزمة الاختبار السريع (jsdom)
 * ════════════════════════════════════════════════════════════════════════
 *  تفحص التفاعل والمنطق (لا تخطيط — للقياسات البصرية استخدم browser-suite).
 *  وهي التي كشفت انكسار المحاكي الكامل بسبب زر محذوف كان مربوطًا في الكود.
 *
 *  ملاحظة تقنية: متغيّرات المحاكي مُعلنة بـ const داخل سكربت الصفحة، فهي
 *  روابط معجمية لا خصائص على window — لذلك كل الفحوصات تُنفَّذ بـ window.eval
 *  داخل نطاق الصفحة نفسه.
 *
 *  التشغيل:
 *     cd tests && npm install jsdom
 *     node jsdom-suite.mjs
 * ════════════════════════════════════════════════════════════════════════
 */
import { JSDOM, VirtualConsole } from './node_modules/jsdom/lib/api.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.join(HERE, '..', 'simulator.html');

let pass = 0, fail = 0;
const ok = (c, label, detail = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✔' : '✘'} ${label}${detail ? ' → ' + detail : ''}`); };
const head = t => console.log(`\n${t}`);

const consoleErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => consoleErrors.push(e.detail?.message || e.message));

const dom = new JSDOM(fs.readFileSync(SIM, 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  // أصل حقيقي: بدونه تُمنع localStorage (وهي التي يحفظ فيها المحاكي طريقة العدّ)
  url: 'https://sabha.local/',
});
await new Promise(r => setTimeout(r, 500));
const { window } = dom, doc = window.document;

/** ينفّذ كودًا داخل نطاق الصفحة (حيث S و el و SETS و FULL مرئية) */
const ev = code => window.eval(code);
const raf = () => new Promise(r => setTimeout(r, 40));

/* 🏠 الشاشة الرئيسية تُفتح أولًا عند الإقلاع — الفحوصات التالية تختبر العدّاد،
   فندخل ذكرًا كما يفعل المستخدم. وللشاشة الرئيسية قسم خاص (⑨). */
head('⓪ الإقلاع: الشاشة الرئيسية أولًا (لا عدّاد مباشرة)');
ok(ev("S.home") === true, 'التطبيق يبدأ على الشاشة الرئيسية');
ok(doc.getElementById('homeView').classList.contains('on'), 'الشاشة الرئيسية ظاهرة');
const tapsBefore = ev('S.c');
ev("tap('home-guard')");
ok(ev('S.c') === tapsBefore, 'ولا يُحسب أي ذكر قبل اختيار ذكر من الأيقونات');
ok(doc.getElementById('toast').classList.contains('on'), 'وتظهر رسالة توجيه: «اختر ذكرًا أولًا»');
ok(ev("el.hGrid.querySelectorAll('[data-open]').length") === 8, 'الشبكة فيها ٨ أيقونات (كل مجموعة)');
ev("openSetHome(0)"); await raf();
ok(ev("S.home") === false && !doc.getElementById('homeView').classList.contains('on'), 'اختيار أيقونة يفتح العدّاد');
ok(ev('S.si') === 0 && ev('S.ii') === 0 && ev('S.c') === 0, 'ويبدأ المجموعة من أول ذكر وعدّ صفر');

head('① التحميل والربط');
ok(consoleErrors.length === 0, 'لا أخطاء عند التحميل', consoleErrors.slice(0, 2).join(' | '));
ok(!doc.getElementById('errBanner')?.classList.contains('on'), 'شريط الأخطاء المرئي غير ظاهر');
ok(ev('SETS.length') === 8, 'المجموعات الثماني موجودة (بعد إضافة الاستغفار والصلاة على النبي)');
ok(ev("SETS.some(s=>s.id==='istighfar') && SETS.some(s=>s.id==='salawat')"), 'المجموعتان الجديدتان: الاستغفار · الصلاة على النبي ﷺ');
ok(ev('typeof bind === "function"'), 'دالة الربط الآمنة موجودة (كل المعالجات مربوطة)');

head('② العدّ والتصفير');
const c0 = ev('S.c'); ev("tap('test')");
ok(ev('S.c') === c0 + 1, 'النقر يزيد العدّ', `من ${c0} إلى ${ev('S.c')}`);
ev('resetCurrent()'); await raf();
ok(ev('S.c') === 0, 'التصفير يصفّر العدّ');
ok(doc.getElementById('toast').classList.contains('on'), 'تظهر رسالة تأكيد فورية (لا زر صامت)');

head('③ المجموعات والانتقال');
ev("openMenu('sets')");
ok(doc.getElementById('menu').classList.contains('on'), 'صفحة المجموعات تُفتح');
ev('selectSet(1, true)'); await raf();
ok(!doc.getElementById('menu').classList.contains('on'), 'اختيار مجموعة يغلق القائمة');
ok(doc.getElementById('setName').textContent.includes('الصباح'), 'اسم المجموعة تحدّث', doc.getElementById('setName').textContent.trim());
ok(doc.getElementById('dhikr').textContent.trim().length > 0, 'اسم الذكر تحدّث (لا اسم قديم)');

head('④ القائمة المنسدلة: كل الإجراءات في كل الصفحات');
const collect = () => ev('(function(){var a=[];document.querySelectorAll("#menu [data-act]").forEach(function(e){if(a.indexOf(e.dataset.act)<0)a.push(e.dataset.act)});return a})()');
const allCodes = new Set();
for (const pg of ['main', 'sets', 'widget', 'sources', 'stats', 'howto']) { ev(`openMenu(${JSON.stringify(pg)})`); collect().forEach(c => allCodes.add(c)); }
ev("closeMenu()"); await raf();
let bad = 0;
for (const code of allCodes) {
  try { ev(`menuAct(${JSON.stringify(code)})`); } catch (e) { bad++; console.log('     ✘', code, e.message); }
}
ok(allCodes.size > 15 && bad === 0, `${allCodes.size} إجراء في القائمة يعمل بلا أخطاء`, `منها ${[...allCodes].filter(c => c.startsWith('toggle:')).length} مفتاحًا`);
ev("closeMenu(); S.read=false; S.dist=false; S.aod=false; S.bg=true; S.badgeRight=true; S.keepAlive=true; render(); applyLayout()");  // نُعيد الحالة بعد جولة المفاتيح (ومنها المفتاح الجديد)

head('⑤ العدّاد في الزاوية العلوية');
ev("S.read=true; S.badgeRight=true; render(); applyLayout()"); await raf();
ok(ev('$("badge").classList.contains("on")'), 'العدّاد يظهر في وضع القراءة');
ok(ev('!$("badge").classList.contains("left")'), 'افتراضيًا في الزاوية اليمنى');
ev('S.badgeRight=false; applyLayout()'); await raf();
ok(ev('$("badge").classList.contains("left")'), 'الخيار ينقله إلى الزاوية اليسرى');
ev('S.badgeRight=true; applyLayout()');

head('⑥ شريط التلقين في الأعلى + القائمة');
ok(ev('$("promptBar").classList.contains("on")'), 'الشريط ظاهر في وضع القراءة');
ok(ev('document.querySelector(".promptbar").previousElementSibling === null'), 'الشريط أول عنصر في طبقة القراءة (فوق اسم الذكر)');
ev("openMenu('main')"); await raf();
ok(ev('!$("promptBar").classList.contains("on") && !$("badge").classList.contains("on")'), 'فتح القائمة يُخفي الشريط والعدّاد');
ev('closeMenu()'); await raf();
ok(ev('$("promptBar").classList.contains("on")'), 'إغلاق القائمة يعيدهما');

head('⑦ الخلفيات');
const rules = ev('(document.documentElement.innerHTML.match(/\\.screen\\.bg-([a-z_]+)\\s*\\.bgimg/g)||[]).length');
ok(rules === 7, '٦ خلفيات + قاعدة التشغيل مضمّنة في CSS', String(rules));
ev("S.read=false; closeMenu()"); await raf();
ok(/bg-on/.test(doc.getElementById('screen').className), 'الخلفية مفعّلة افتراضيًا');
let swaps = 0;
for (let i = 0; i < 6; i++) { ev(`selectSet(${i}, false)`); if (/bg-/.test(doc.getElementById('screen').className)) swaps++; }
ok(swaps === 6, 'كل مجموعة لها خلفية تعمل', `${swaps}/6`);
const embedded = ev('(document.documentElement.innerHTML.match(/data:image\\/jpeg;base64,/g)||[]).length');
ok(embedded === 8, 'الصور مضمّنة داخل الملف (خلفيتا التطبيق (نهار/ليل) + ٦ خلفيات مجموعات · يعمل بلا إنترنت)', String(embedded));

head('⑧ العدّ بلا نظر: نقرة · حركة · تاج');
ev("openMenu('main')"); await raf();
ok(ev("document.querySelector('#menu').textContent.includes('العدّ بلا نظر')"), 'قسم «العدّ بلا نظر» موجود');
ok(ev("!!document.querySelector('#menu [data-act=\"seg:cMode:0\"]')"), 'محدّد طريقة العدّ (نقرة/حركة/تاج)');

// وضع الحركة
ev("menuAct('seg:cMode:1')"); await raf();
ok(ev('S.cMode') === 1, 'التبديل إلى «حركة» يعمل');
ok(ev("getComputedStyle(document.getElementById('btnMotion')).display !== 'none'"), 'زر محاكاة الحركة ظاهر');
ok(ev("!!document.querySelector('#menu [data-act=\"seg:mSens:1\"]')"), 'محدّد الحساسية ظاهر مع وضع الحركة');
ev("closeMenu()"); await raf();
const cBefore = ev('S.c');
ev("document.getElementById('btnMotion').click()"); await raf();
ok(ev('S.c') === cBefore + 1, 'نكزة واحدة = ذكر واحد');
ok(ev('S.motionLevel') > 0, 'مؤشر الحركة يعمل');
ev('toggleAOD()'); await raf();
const cAod = ev('S.c');
ev("document.getElementById('btnMotion').click()"); await raf();
ok(ev('S.c') === cAod + 1, 'العدّ يعمل والشاشة خافتة (وضع السكون) ✓');
ok(ev("(document.getElementById('aodMode')||{}).textContent.includes('الحركة')"), 'شاشة السكون تشرح الوضع');
ev('toggleAOD()'); await raf();

// 🆕 إصلاح «لا يعدّ أثناء الخفوت»: نقرة الشاشة الخافتة نفسها = نكزة رسغ
ev('toggleAOD()'); await raf();
const cDim = ev('S.c');
ev('aodFlick()'); await raf();
ok(ev('S.c') === cDim + 1, 'النقر على الشاشة الخافتة = نكزة رسغ وتعدّ ✓');
ok(ev("(document.getElementById('aodHint')||{}).textContent.includes('نكزة')"), 'الشاشة الخافتة تشرح: «انقر الشاشة = نكزة رسغ»');
ok(ev("!!document.getElementById('aodDot')"), 'نقطة كشف الحركة موجودة (مطابقة لـ aodLiteView في التطبيق)');
ev('toggleAOD()'); await raf();

// 🔋 إبقاء العدّ حيًّا (الخيار التلقائي الجديد — طلب المستخدم)
ev("openMenu('main')"); await raf();
ok(ev('S.keepAlive') === true, 'خيار «إبقاء العدّ حيًّا» مفعّل تلقائيًا من أول فتح');
ok(ev("document.querySelector('#menu').textContent.includes('مدة الاستيقاظ')"), 'توجيه إعداد الإضاءة (٧٠ ثانية) ظاهر في القائمة');
ok(ev("!!document.querySelector('#menu [data-act=\"toggle:keepAlive\"]')"), 'مفتاح الخيار موجود وقابل للنقر');
ev("menuAct('toggle:keepAlive')"); await raf();
ok(ev('S.keepAlive') === false, 'يمكن إطفاء الخيار (توفير بطارية)');
ok(ev("document.querySelector('#menu').textContent.includes('مُطفأ')"), 'وعند الإطفاء تظهر حالة صريحة');
ev("menuAct('toggle:keepAlive')"); await raf();
ok(ev('S.keepAlive') === true, 'وإعادة تفعيله تعمل');
ev("closeMenu()"); await raf();

// وضع التاج
ev("openMenu('main'); menuAct('seg:cMode:2')"); await raf();
ok(ev('S.cMode') === 2, 'التبديل إلى «تاج» يعمل');
ok(ev("getComputedStyle(document.getElementById('btnCrown')).display !== 'none'"), 'زر التاج ظاهر');
ev("closeMenu()"); await raf();
const cCrown = ev('S.c');
ev("document.getElementById('btnCrown').click()"); await raf();
ok(ev('S.c') === cCrown + 1, 'نقرة تاج = ذكر واحد');

// 🆕 التاج والشاشة خافتة: يوقظها ولا يعدّ صامتًا (كما في watchOS)
ev('toggleAOD()'); await raf();
const cCrownDim = ev('S.c');
ev('aodFlick()'); await raf();
ok(ev('S.c') === cCrownDim, 'التاج في الوضع الخافت لا يعدّ صامتًا');
ok(ev('S.aod') === false, 'بل يوقظ الشاشة (مطابقة لسلوك watchOS: يقظ ثم يعدّ)');

// تحذير النقرة المزدوجة
ev("openMenu('main'); menuAct('seg:cMode:0')"); await raf();
ok(ev("document.querySelector('#menu').textContent.includes('تحتاج شاشة مضيئة')"), 'تحذير صريح للنقرة المزدوجة');
ev('closeMenu()'); await raf();

// 🆕 النقرة المزدوجة والشاشة خافتة: لا عدّ صامت + رسالة تشرح
ev('toggleAOD()'); await raf();
const cDimTap = ev('S.c');
ev('aodFlick()'); await raf();
ok(ev('S.c') === cDimTap, 'النقرة المزدوجة لا تعدّ والشاشة خافتة (قيد watchOS)');
ok(doc.getElementById('toast').classList.contains('on'), 'ورسالة تشرح: «ارفع رسغك أولًا»');
ev('if(S.aod) toggleAOD()'); await raf();

head('⑩ التحديث v2 (الأصوات · الإحصاءات · التعريف · السلوك)');

// 🔊 الصوت + شدة الاهتزاز
// ملاحظة: فحص سابق ينقر كل الأزرار، فلا نفترض الحالة الابتدائية — نقيس التغيّر
ev("openMenu('main')"); await raf();
const soundBefore = ev('S.sound');
ev("menuAct('toggle:sound')"); await raf();
ok(ev('S.sound') === !soundBefore, 'مفتاح الصوت يعمل (نقرة + نغمة إتمام)');
ev("menuAct('toggle:sound')"); await raf();
ok(ev('S.sound') === soundBefore, 'ويُطفأ أيضًا (لا يعلق)');
ev("menuAct('seg:hLevel:2')"); await raf();
ok(ev('S.hLevel') === 2, 'شدة الاهتزاز: التبديل إلى «قوي» يعمل');
ev("menuAct('seg:hLevel:0')"); await raf();
ok(ev('S.hLevel') === 0, 'وشدة «ناعم» أيضًا');
ev("menuAct('seg:hLevel:1')"); await raf();

// 📊 صفحة الإحصاءات
ev("tap('gesture'); tap('gesture')"); await raf();
const histBefore = ev('S.histTotal');
ev("openMenu('stats')"); await raf();
ok(ev('S.histTotal') >= 2, 'سجلّ الإحصاءات يُحسب مع كل ذكر (الإجمالي: ' + histBefore + '→' + ev('S.histTotal') + ')');
ok(ev("document.querySelectorAll('#menu .hbar').length") === 7, 'أعمدة آخر ٧ أيام (٧ أعمدة)');
ok(ev("document.querySelector('#menu').textContent.includes('ذكرًا اليوم')"), 'العدد الكبير «ذكرًا اليوم» ظاهر');
ok(ev("document.querySelector('#menu').textContent.includes('سلسلة')"), 'سلسلة الأيام المتتالية ظاهرة');

// ❓ صفحة التعريف (شاشة الترحيب)
ev("openMenu('howto')"); await raf();
ok(ev("document.querySelectorAll('#menu .hcard').length") === 3, 'شاشة التعريف: ٣ بطاقات (نقرة · حركة · قراءة)');
ok(ev("!!document.querySelector('#menu [data-act=\"close\"]')"), 'زر «ابدأ التسبيح» يغلق التعريف');

// 📜 صفحة المصادر (قرار: في القائمة فقط، بلا أي سطر على شاشة العدّاد)
ev("openMenu('sources')"); await raf();
const srcTxt = () => ev("document.querySelector('#menu').textContent");
ok(srcTxt().includes('حِصْنُ الْمُسْلِم'), 'صفحة المصادر تذكر اسم الكتاب');
ok(srcTxt().includes('hisnmuslim.com'), 'صفحة المصادر تذكر الموقع الرسمي');
ok(srcTxt().includes('القحطاني'), 'صفحة المصادر تذكر المؤلف');
const counterHasSource = () => ev("['#dhikr','#setName','#nextLine','#aodLbl','#trackRow']"
  + ".map(s=>{const e=document.querySelector(s);return e?e.textContent:''}).join(' ')");
ok(!/hisnmuslim|القحطاني|حِصْن|حصن/.test(counterHasSource()),
   'لا أثر للمصدر على شاشة العدّاد (التوثيق في القائمة فقط)');

// 📖 مطابقة الكتاب: أعداد المجموعات الأربع (حصن المسلم)
const bookCounts = ev("SETS.slice(0,4).map(s=>s.items.length).join('-')");
ok(bookCounts === '12-22-21-15', 'أذكار الكتاب: بعد الصلاة ١٢ · الصباح ٢٢ · المساء ٢١ · النوم ١٥', bookCounts);
ok(ev("SETS[0].items.filter(i=>i.n===33).length") === 3, 'التسبيح بعد الصلاة ٣٣×٣');
ok(ev("SETS[0].items.find(i=>i.id==='tahlil_yuhyi').n") === 10, 'تهليل «يحيي ويميت» عشر مرات (مغرب وفجر)');
ok(ev("SETS[1].items.some(i=>i.id==='tahlil100' && i.n===100) && !SETS[1].items.some(i=>i.id==='tahlil10')"),
   'الصباح: تهليل مائة فقط — ولا ذكر «عشرًا» (بطلب المستخدم)');
ok(ev("SETS[2].items.some(i=>i.id==='tahlil10' && i.n===10)"), 'المساء: التهليل عشر مرات (كما في الكتاب)');
ok(ev("SETS[0].items.find(i=>i.id==='tahlil_mulk').t.startsWith('اللَّهُمَّ لَا مَانِعَ')"),
   'بعد الصلاة: الذكر الثالث = «اللهم لا مانع لما أعطيت…»');
ok(ev("SETS[0].items.find(i=>i.id==='tahlil_mulk').n") === 1,
   'وهذا الدعاء مرة واحدة (و«ثلاثًا» في الكتاب للتهليل قبله لا للدعاء)');
ok(ev("SETS[0].items.filter(i=>i.n===1).length") === 7, 'معظم أذكار بعد الصلاة مرة واحدة بعدّها');
ok(ev("SETS[3].items.find(i=>i.id==='akbar').n") === 34, 'النوم: التكبير ٣٤');

// 🆕 المجموعتان الجديدتان في قائمة المجموعات
ev("openMenu('sets')"); await raf();
ok(ev("!!document.querySelector('#menu [data-act=\"set:5\"]')"), 'تسبيح مفتوح في قائمة المجموعات (ترتيب مطابق للتطبيق)');
ok(ev("!!document.querySelector('#menu [data-act=\"set:6\"]')"), 'الاستغفار في قائمة المجموعات');
ok(ev("!!document.querySelector('#menu [data-act=\"set:7\"]')"), 'الصلاة على النبي ﷺ في قائمة المجموعات');
ev("menuAct('set:6')"); await raf();
ok(ev('set().id') === 'istighfar', 'اختيار مجموعة الاستغفار يعمل');
ev("menuAct('set:7')"); await raf();
ok(ev('set().id') === 'salawat', 'واختيار الصلاة على النبي يعمل');
ev("menuAct('set:0')"); await raf();

// 🎨 اللغة البصرية الجديدة
ok(ev("getComputedStyle(document.documentElement).getPropertyValue('--emerald').trim()") !== '', 'لوحة الألوان الجديدة (زمردي) مُعرَّفة');
ok(ev("!!document.getElementById('ringGrad')"), 'تدرّج الحلقة الزمردي موجود في SVG');

head('⑧ب شاشة إتمام المجموعة (كانت الكلمات تتكسّر وتسقط)');
ev("S.si=0; S.ii=SETS[0].items.length-1; S.c=SETS[0].items[S.ii].n; S.done=false; S.start=Date.now()-214000;");
ev("advanceOrFinish('tap')");
await new Promise(r => setTimeout(r, 900));
ok(ev("document.getElementById('doneView').classList.contains('on')"), 'شاشة الإتمام ظهرت بعد آخر ذكر');
ok(ev("document.querySelectorAll('#doneView .scell').length") === 3, 'ثلاث خلايا ملخّص (بلا صفوف متزاحمة)');
ok(ev("[...document.querySelectorAll('#doneView .scell b')].map(e=>e.scrollWidth<=e.clientWidth+1).every(Boolean)"),
   'لا كلمة تخرج عن حدود خليتها');
ok(ev("document.querySelectorAll('#doneView .srow2').length") === 0, 'صفوف «سطر طويل» القديمة أُزيلت');
const dur = ev("document.getElementById('dTime').textContent.trim()");
ok(/^\d+:\d\d$|^\d+ ث$/.test(dur), 'المدة بصيغة قصيرة لا تتكسّر', dur);
ev("hideDone(); S.si=0; S.ii=0; S.c=0; render(); renderMenu();");

head('⑧ج الخروج بضغطة التاج ثم العودة (لا يُفقد العدّ)');
ev("closeMenu(); S.si=0; S.ii=4; S.c=17; S.read=false; render(); applyLayout()");
ev("simulateLeaveReturn()");                       // خروج (كما لو ضغط المستخدم التاج)
const beforeLeave = ev("JSON.stringify({c:S.c, ii:S.ii, si:S.si})");
ok(ev("document.getElementById('leaveFace').classList.contains('on')"), 'ظهرت واجهة «خرجت من التطبيق» (محاكاة النظام)');
await new Promise(r => setTimeout(r, 1900));       // النظام يُخفي الواجهة بعد لحظات
ev("simulateLeaveReturn()");                       // عودة: افتح السبحة من جديد
await raf();
const afterReturn = ev("JSON.stringify({c:S.c, ii:S.ii, si:S.si})");
ok(beforeLeave === afterReturn, 'العدّ والذكر والمجموعة كما هي بعد العودة', afterReturn);
ok(!ev("document.getElementById('leaveFace').classList.contains('on')"), 'واجهة الخروج اختفت بعد العودة');
ok(ev("S.keepAlive") === true, '«إبقاء العدّ حيًّا» ما زال مفعّلًا (تُشغَّل جلسة جديدة تلقائيًا)');
ev("S.c=0; S.ii=0; render(); renderMenu();");

head('⑨ 🏠 الشاشة الرئيسية: أيقونات · متابعة · آخر ثلاثة · والعودة بعد الإتمام');
// نبدأ من حالة عدّ جزئي في مجموعة أخرى
ev("closeMenu(); hideDone(); S.si=1; S.ii=0; S.c=0; S.done=false; S.home=true; renderHome(); applyLayout();");
await raf();
ok(!doc.getElementById('hCont').classList.contains('on'), '«متابعة» مخفية حين لا عدّ ناقص (ذكر جديد تمامًا)');
ev("S.si=1; S.ii=3; S.c=12; renderHome();");
ok(doc.getElementById('hCont').classList.contains('on'), '«متابعة» تظهر مع عدّ ناقص');
ok(doc.getElementById('hContSub').textContent.includes('4/'), 'وتُبيّن موضعك الحالي', doc.getElementById('hContSub').textContent.trim());
ev("continueSaved()");
ok(ev('S.home') === false && ev('S.c') === 12 && ev('S.ii') === 3, '«متابعة» تعود للعدّ من نفس الرقم والموضع');
// 🚫 «آخرها» **أُلغيت** من الرئيسية (قرار المستخدم) — التتبّع الداخلي يبقى
ev("S.c=0; S.ii=0; goHome(); openSetHome(4); goHome(); openSetHome(2); goHome();");
ok(ev('S.recent[0]') === 2 && ev('S.recent[1]') === 4 && ev('new Set(S.recent).size') === ev('S.recent.length'),
   'يُتتبَّع آخر الأذكار داخليًّا (الأحدث أولًا بلا تكرار)', JSON.stringify(ev('S.recent')));
ok(!ev("document.getElementById('hRecent')"), '🚫 ولا خانة «آخرها» في الرئيسية (أُلغيت)');
ok(ev("document.querySelectorAll('#homeView [data-recent]').length") === 0, 'ولا شرائح أذكار سابقة');
ok(ev("document.querySelector('style').textContent.includes('.home .hrecent')") === false, 'ولا بقايا تنسيق لها');
// العودة بعد الإتمام
ev("openSetHome(3)");
ev("S.ii = set().items.length - 1; S.c = item().n; S.done=false; render();");
ev("tap('finish-set')"); await raf();
ok(doc.getElementById('doneView').classList.contains('on'), 'شاشة الإتمام ظهرت');
ok(doc.getElementById('dHome') !== null, 'وفيها زر «🏠 الشاشة الرئيسية»');
ev("goHome()"); await raf();
ok(ev('S.home') === true && doc.getElementById('homeView').classList.contains('on'), 'والضغط عليه يرجع للشاشة الرئيسية');
ok(!doc.getElementById('doneView').classList.contains('on'), 'وشاشة الإتمام أُغلقت');
// زر ⌂ داخل العدّاد (للمجموعات المفتوحة التي لا تنتهي)
ev("openSetHome(5); S.c = 7; render(); bind && 0;");
ev("goHome()"); await raf();
ok(ev('S.home') === true, 'زر ⌂ داخل العدّاد يرجع للرئيسية (المجموعات المفتوحة)');
ok(ev("document.getElementById('btnHome') !== null"), 'وزر ⌂ موجود فعلًا في الشاشة');
// 🎛️ طريقة العدّ: تُختار من الشاشة الرئيسية وتُحفظ فتبقى عند كل فتح
ev("goHome(); setCountingMode(0); renderHome();"); await raf();
ok(ev("el.hMode.querySelectorAll('[data-mode]').length") === 3, 'ثلاث طرق للعدّ في الشاشة الرئيسية (نقرة · حركة · تاج)');
ok(ev("el.hMode.querySelectorAll('.mchip.on').length") === 1 &&
   ev("el.hMode.querySelector('.mchip.on').dataset.mode") === '0', 'الطريقة الحالية معلَّمة بوضوح');
ev("el.hMode.querySelector('[data-mode=\"2\"]').click()"); await raf();
ok(ev('S.cMode') === 2, 'الضغط على «تاج» يغيّر طريقة العدّ فورًا', String(ev('S.cMode')));
ok(ev("localStorage.getItem('sabha.cMode')") === '2', 'وتُحفظ في ذاكرة الجهاز ⇒ تبقى عند كل فتح للتطبيق');
ok(ev("el.hMode.querySelector('.mchip.on').dataset.mode") === '2', 'والعلامة انتقلت إلى «تاج»');
ok(ev("el.hFoot.textContent").includes('خافتة'), 'وسطر أسفل الشاشة يوضّح أن الوضع يعمل والشاشة خافتة', ev('el.hFoot.textContent'));
ev("setCountingMode(0); renderHome();");   // نُعيد الوضع الافتراضي لبقية الفحوص
ok(ev("localStorage.getItem('sabha.cMode')") === '0', 'وتغيير الوضع مرّة أخرى يُحفظ أيضًا');

// تنظيف للفحوصات التالية
ev("openSetHome(0); S.c = 0; S.ii = 0; render(); renderMenu();");

head('🏠ب زرّ القائمة ☰ في الشاشة الرئيسية (اختفت أيقونته ⇒ أُصلحت وحُرست)');
ev("goHome(); renderHome(); applyLayout();"); await raf();
ok(ev("!!document.getElementById('hMenu') && document.getElementById('hMenu').innerHTML.includes('<svg')"),
   'زرّ ☰ ظاهر في أعلى الشاشة الرئيسية وبأيقونة متجهة (لا فراغ)');
ok(ev("typeof el.hMenu !== 'undefined'"), 'والزرّ مُعرَّف في خريطة عناصر المحاكي (درس: نداء على اسم غير معرَّف يمرّ صامتًا)');
ev("document.getElementById('hMenu').click()"); await raf();
ok(ev('S.menu') === true && ev('S.page') === 'main', 'النقر عليه يفتح القائمة على صفحتها الرئيسية');
ok(ev('S.home') === true, 'والشاشة الرئيسية لا تُفقد (تبقى هي المرجع عند الإغلاق)');
ok(ev("document.getElementById('menu').classList.contains('on')"),
   'والقائمة تظهر فعلًا: طبقة عليا مستقلة لا يخفيها إخفاء العدّاد');
ev("closeMenu()"); await raf();
ok(ev("document.getElementById('homeView').classList.contains('on')") && ev('S.home') === true,
   'وبإغلاقها تعود إلى الشاشة الرئيسية كما كانت');
ev("el.btnMenu.click()"); await raf();
ok(ev('S.menu') === true, 'وزرّ ☰ السفلي (داخل العدّاد) ما زال يفتح القائمة');
ev("closeMenu(); goHome(); renderHome(); applyLayout();"); await raf();

head('📜أ التلقين: يستمر للذكر التالي · وبلا اهتزاز عند نهاية التمرير (طلب المستخدم)');
ev("closeMenu(); goHome(); openSetHome(1); S.read = true; render(); applyLayout();"); await raf();
// ⚠️ jsdom بلا محرّك تخطيط: ارتفاع التمرير صفر، فنُعطي النصّ طولًا وهميًا ليعمل التلقين
ev("window.__realTotal = promptTotal; promptTotal = () => 200; el.rdScroll.scrollTop = 0;");
ok(ev("(FULL[item().t]||item().t).length > 80"), 'الذكر الأول في «الصباح» نصّه طويل (آية الكرسي) — مناسب لفحص التمرير', ev("item().t.slice(0, 18)"));
ev("setAutoScroll(true)"); await raf();
ok(ev('S.autoScroll') === true, '«تمرير تلقائي» صار تفضيلًا محفوظًا (لا حالة لحظية)');
ok(ev("localStorage.getItem('sabha.autoScroll')") === '1', 'ويُحفظ في ذاكرة الجهاز ⇒ يبقى عند كل فتح');
ok(ev('S.read') === true, 'وتشغيله يفتح وضع القراءة تلقائيًا (مكان التمرير)');
// إكمال عدّ الذكر ⇒ يجب أن ينتقل الذكر و«يواصل» التمرير
ev("S.c = item().n; advanceOrFinish('tap');"); await new Promise(r => setTimeout(r, 900));
ev("el.rdScroll.scrollTop = 0;");
ok(ev('S.ii') === 1, 'اكتمل الذكر الأول وانتقل إلى الثاني');
ok(ev('S.prompt') === true && ev('S.autoScroll') === true, 'والتلقين ما زال يعمل بعد الانتقال (كان يتوقف)', `ii=${ev('S.ii')}`);
ok(ev('S.y') < 12, 'ويبدأ تمرير الذكر الجديد من أعلاه (لا من نهاية النص السابق)');
// عدّادات الاهتزاز: نستبدل navigator.vibrate ونقرّب النص من نهايته
ev("window.__vh = 0; try { navigator.vibrate = () => { window.__vh++; return true; }; } catch(e){}");
ev("S.y = promptTotal();"); await new Promise(r => setTimeout(r, 800));
ok(ev('window.__vh') === 0, 'لا اهتزاز عند نهاية التمرير (كان يختلط مع اهتزاز العدّ والإتمام)');
ok(ev('S.prompt') === false, 'والتلقين يتوقف عند النهاية بإشارة بصرية فقط');
ok(ev("el.pbLabel.textContent").includes('إعادة'), 'وشريط التلقين يعرض «انتهى — إعادة»');
// إيقاف التفضيل
ev("setAutoScroll(false)"); await raf();
ok(ev('S.autoScroll') === false && ev("localStorage.getItem('sabha.autoScroll')") === '0', 'وإيقافه يُحفظ أيضًا');
ev("if (window.__realTotal) promptTotal = window.__realTotal; S.read = false; selectSet(0, false); render(); applyLayout();"); await raf();

head('⏭ التالي: زرّ الانتقال بين الأذكار داخل المجموعة (بلا إكمال العدّ)');
ok(ev("!!document.getElementById('nextLine').querySelector('svg')"), 'زرّ «التالي» في شاشة الساعة بأيقونة متجهة');
ok(ev("document.getElementById('nextLine').textContent").includes('التالي:'), 'ويُظهر اسم الذكر التالي', ev("document.getElementById('nextLine').textContent").trim().slice(0, 22));
ev("openSetHome(0); S.c = 7; render();"); await raf();
const beforeII = ev('S.ii');
ev("document.getElementById('nextLine').click()"); await raf();
ok(ev('S.ii') === beforeII + 1 && ev('S.c') === 0, 'النقر ينقل للذكر التالي ويصفّر عدّاده (بلا إكمال)', `ii=${ev('S.ii')} · c=${ev('S.c')}`);
ok(ev('S.done') === false, 'ولا يُعلن إتمام المجموعة');
// آخر ذكر: لا انتقال ولا إتمام
ev("openSetHome(0); S.ii = set().items.length - 1; render();"); await raf();
ev("document.getElementById('nextLine').click()"); await raf();
ok(ev('S.ii') === ev('set().items.length - 1') && ev('S.done') === false, 'وفي آخر ذكر: لا انتقال ولا إعلان إتمام');
ok(ev('el.toast.textContent').includes('آخر ذكر'), 'بل رسالة صريحة «هذا آخر ذكر في المجموعة»');

head('📅 «اليوم» في الرئيسية: عدد أذكار اليوم — لا الإجمالي التراكمي');
ok(ev("renderHome.toString().includes(\"S.hist[dayKey(new Date())]\")"),
   'الترويسة تقرأ مفتاح اليوم (كانت تعرض الإجمالي التراكمي)');
ok(!ev("renderHome.toString().includes('S.histTotal || 0')"), 'ولا تعرض الإجمالي التراكمي في مكان العدّ اليومي');
ok(ev("document.querySelector('.hday').title.includes('يبدأ من صفر كل يوم')"), 'ولها تلميح يشرح المعنى');
ev("S.hist = {}; histBump(3); renderHome();"); await raf();
const todayShown = ev("document.getElementById('hToday').textContent");
ok(todayShown === '3', 'وبعد ٣ ضغطات اليوم تظهر ٣', todayShown);
ev("S.hist['2020-01-01'] = 40; S.histTotal = 43; renderHome();"); await raf();
ok(ev("document.getElementById('hToday').textContent") === '3', 'ولا تتأثّر بالإجمالي القديم (٤٠ من يوم آخر)');
ev("S.hist = {}; S.histTotal = 0; renderHome();"); await raf();

head('🧩 بطاقات الرئيسية: تُقاس بمساحة البطاقة (لا قصّ) + الشريحة المفعّلة بلون الأيقونات');
ok(ev("typeof fitHomeTiles === 'function'"), 'دالة قياس البطاقات موجودة');
ok(ev("applyLayout.toString().includes('fitHomeTiles()')"), 'وتُنادى في كل رسم تخطيط (فتتبع أيّ مقاس/خطّ)');
ok(ev("document.querySelector('style').textContent.includes('* var(--tk')"),
   'ومقاسات البطاقة مضروبة في --tk (لا مقاسات ثابتة تُقصّ)');
ok(ev("document.querySelector('style').textContent.includes('.home .tile{display:flex;flex-direction:row')"),
   '🧩 البطاقة صفّية: أيقونة يمينًا وكتابة يسارًا');
ok(ev("renderHome.toString().includes('<span class=\"tt\">')"),
   'والاسم والعدّ في حاوية واحدة (فتتّسع معًا بلا قصّ)');
// 🚫 لا خانة «آخرها» إطلاقًا (حتى لو كان التتبّع ممتلئًا)
ev("S.recent = [0,1,2,3]; renderHome();"); await raf();
ok(ev("renderHome.toString().includes('data-recent')") === false
   && ev("renderHome.toString().includes('hRecent')") === false, '🚫 الرئيسية لا ترسم «آخرها» أبدًا (لا كود شرائح)');
ok(ev("document.getElementById('hGrid').parentElement.querySelectorAll('#hRecent').length") === 0,
   'ولا عنصر لها في الشجرة');
// jsdom لا يفكّ var() داخل الخاصية المختصرة ⇒ نفحص القاعدة نصًّا (والقياس الحقيقي في browser-suite ⑦ز)
ok(ev("document.querySelector('style').textContent.includes('.home .mchip.on{background:var(--teal)')"),
   'قاعدة الشريحة المفعّلة: ملء بلون الأيقونات نفسه (var(--teal))');
ok(ev("document.querySelector('style').textContent.includes('.screen.day .home .mchip.on,.screen.day .mseg span.on')"),
   'ولها نسخة نهاري داكنة خاصة');

head('⏮⏭ التنقّل بين أذكار المجموعة: زرّان في التذييل (يظهران في العدّ والقراءة)');
ok(ev("!!document.getElementById('btnPrev') && !!document.getElementById('nextLine')"), 'زرّان: «السابق» و«التالي»');
ok(ev("document.getElementById('btnPrev').closest('.vfoot') !== null && document.getElementById('nextLine').closest('.vfoot') !== null"),
   'وكلاهما في التذييل (فلا يختفي أحدهما في وضع القراءة)');
ok(ev("document.getElementById('btnPrev').querySelector('svg') !== null"), 'وزرّ السابق بأيقونة متجهة');
ev("closeMenu(); hideDone(); S.home=false; openSetHome(0); render(); applyLayout();"); await raf();
ok(ev("document.getElementById('btnPrev').classList.contains('off')"), 'في أول ذكر: زرّ السابق معطّل بصريًّا');
ev("document.getElementById('nextLine').click()"); await raf();
ok(ev('S.ii') === 1 && ev('S.c') === 0, 'زرّ التالي ينقل للذكر الثاني ويصفّر العدّ');
ok(!ev("document.getElementById('btnPrev').classList.contains('off')"), 'وزرّ السابق ينشط بعد الانتقال');
ev("document.getElementById('btnPrev').click()"); await raf();
ok(ev('S.ii') === 0, 'وضغط السابق يرجع للذكر الأول', `ii=${ev('S.ii')}`);
ev("document.getElementById('btnPrev').click()"); await raf();
ok(ev("el.toast.textContent").includes('أول ذكر'), 'وفي الأول يقول: «هذا أول ذكر في المجموعة»');
ok(ev('S.c') === 0 && ev('S.done') === false, 'ولا يُفسد العدّ ولا يُعلن إتمامًا');
// في وضع القراءة أيضًا
ev("S.read = true; render(); applyLayout();"); await raf();
ok(ev("document.getElementById('nextLine').closest('.vfoot') !== null"),
   'وفي وضع القراءة يبقى زرّا التنقّل ظاهرين في التذييل');
ev("document.getElementById('nextLine').click()"); await raf();
ok(ev('S.ii') === 1, 'والانتقال يعمل من وضع القراءة أيضًا');
ev("S.read = false; selectSet(0, false); render(); applyLayout();"); await raf();

head('🎨 تناسق الأيقونات: أسلوب واحد (رسم بخطّ · سماكة واحدة · حجم واحد)');
const icoStyle = ev(`(() => {
  const ids = ['btnReset','btnDist','btnPrompt','btnMenu','btnPrev','nextLine'];
  const rows = ids.map(id => {
    const svg = document.getElementById(id)?.querySelector('svg'); if (!svg) return {id, missing:true};
    const cs = getComputedStyle(svg);
    return { id, sw: cs.strokeWidth, fill: cs.fill, w: Math.round(svg.getBoundingClientRect().width) };
  });
  return JSON.stringify(rows);
})()`);
const rows = JSON.parse(icoStyle);
ok(rows.every(r => !r.missing), 'كل أزرار شاشة العدّ بأيقونات موجودة', rows.filter(r=>r.missing).map(r=>r.id).join(' · '));
ok(rows.every(r => r.sw === rows[0].sw), 'سماكة القلم موحّدة في كل الأيقونات', rows.map(r=>r.id+':'+r.sw).join(' · '));
ok(rows.every(r => r.fill === 'none' || r.fill === rows[0].fill), 'وأسلوب الرسم موحّد (لا خلط بين ممتلئ ومفرّغ)', rows[0].fill);
// jsdom بلا محرّك تخطيط ⇒ نقيس الحجم المعلَن في الوسم نفسه (width="14") — والقياس الحقيقي في browser-suite
const declared = JSON.parse(ev(`JSON.stringify({
  bar: ['btnReset','btnDist','btnPrompt','btnMenu'].map(id => +document.getElementById(id).querySelector('svg').getAttribute('width')),
  nav: ['btnPrev','nextLine'].map(id => +document.getElementById(id).querySelector('svg').getAttribute('width'))})`));
ok(declared.bar.every(w => w === declared.bar[0]), 'أيقونات صف الأدوات بمقاس معلَن واحد (١٤)', declared.bar.join(' · '));
ok(declared.nav.every(w => w === declared.nav[0]), 'وأيقونتا التنقّل بمقاس واحد بينهما (١١)', declared.nav.join(' · '));

head('☀️🌙 ألوان الوضع النهاري: خطّ الذكر كربوني');
ev("setTheme('day'); render(); applyLayout();"); await raf();
const dayColors = ev(`(() => {
  const g = s => getComputedStyle(document.querySelector(s)).color.match(/\\d+/g).map(Number);
  return JSON.stringify({ dhikr: g('#screen .dhikr'), num: g('.ring .num') });
})()`);
const dc = JSON.parse(dayColors);
const lum = c => (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255;
ok(lum(dc.dhikr) < 0.18, 'لون خطّ الذكر كربوني داكن فعلًا', `rgb(${dc.dhikr})`);
ok(lum(dc.num) < 0.15, 'وعدّاد الرقم كربوني أغمق', `rgb(${dc.num})`);
ev("setTheme('night'); render(); applyLayout();"); await raf();
const nightColor = ev("getComputedStyle(document.querySelector('#screen .dhikr')).color");
ok(lum(nightColor.match(/\d+/g).filter((_,i)=>i<3).map(Number)) > 0.7, 'وفي الليلي يبقى فاتحًا', nightColor);
ev("setTheme('day'); render(); applyLayout();"); await raf();   // (كان الليلي هو المضبوط قبل هذه الأسطر)
ok(ev("document.querySelector('style').textContent.includes('.screen.day.bg-on .bgimg{filter:invert(1) hue-rotate(180deg)')"),
   '☀️ خلفيات الأذكار تظهر في النهاري (عكس الصورة إلى نسخة فاتحة)');
ok(ev("document.querySelector('style').textContent.includes('.appbg{position:absolute;inset:0;z-index:0;background-size:cover')"),
   '🖼️ خلفية التطبيق الأساسية (حلقة سبحة + أيقونات العدّ) موجودة');
ok(ev("document.querySelector('style').textContent.includes('.screen.day .appbg{background-image:url(')"),
   'وفي النهاري نسخة حقيقية ورقية (لا فلتر عكس)');
ok(ev("document.querySelector('style').textContent.includes('.screen.home-up .appbg{opacity:.75}')"),
   '✅ وتظهر في الشاشة الرئيسية فقط');
ok(ev("document.querySelector('style').textContent.includes('.screen.home-up.bg-on .bgimg,.screen.home-up .bgdim{opacity:0}')"),
   'وخلفيات الأذكار تختفي في الرئيسية (لا تتراكب)');
ok(ev("applyLayout.toString().includes(\"toggle('home-up'\")"), 'والفصل يُطبَّق في كل رسم تخطيط');
ev("goHome(); applyLayout();"); await raf();
ok(ev("document.getElementById('screen').classList.contains('home-up')"), 'في الرئيسية: صنف home-up موجود');
ok(ev("getComputedStyle(document.getElementById('bgimg')).opacity") === '0', 'وخلفية الذكر مخفيّة هناك');
ev("openSetHome(0); applyLayout();"); await raf();
ok(!ev("document.getElementById('screen').classList.contains('home-up')"), 'وفي شاشة العدّ: الصنف يزول');
ok(ev("getComputedStyle(document.getElementById('bgimg')).opacity") !== '0', 'وخلفية الذكر تعود كما كانت');
ok(ev("document.querySelector('style').textContent.includes('padding:19px 12px 11px;background:transparent}')"),
   '🏠 الرئيسية بلا ستارة خاصة (شفافة تمامًا فوق خلفيتها)');
ok(ev(`getComputedStyle(document.getElementById('screen')).getPropertyValue('--teal').trim()`) === '#0d9488',
   'لوحة النهاري تعرّف تيلًا أغمق (يُقرأ على الورقي)');
ev("S.read = true; render(); applyLayout();"); await raf();
const rdDay = ev("(() => { const c = getComputedStyle(document.getElementById('rdText')).color.match(/\\d+/g).slice(0,3).map(Number); return (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255; })()");
ok(rdDay < 0.2, 'نصّ وضع القراءة في النهاري كربوني (كان أبيض فبدا باهتًا)', rdDay.toFixed(2));
ev("S.read = false; setTheme('auto'); render(); applyLayout();"); await raf();

head('🚪 زرّ الخروج: للمحاكي وحده (خارج شاشة الساعة)');
ok(ev("!document.getElementById('btnLeave')"), 'لا يوجد زرّ خروج داخل شاشة الساعة (كمثل التطبيق الحقيقي)');
ok(ev("!!document.getElementById('actLeave')"), 'ومحاكاة الخروج موجودة في اللوحة الجانبية للمحاكي فقط');
ok(ev("(document.getElementById('actLeave').textContent||'').includes('محاكاة')"), 'وبعنوان صريح: «محاكاة الخروج»');

head('☀️🌙 المظهر: تلقائي · نهاري · ليلي');
ev("openMenu('main')"); await raf();
ok(ev("el.menu.textContent").includes('المظهر'), 'في القائمة قسم «المظهر»');
ok(ev("el.menu.querySelector('[data-seg=\"theme\"]') !== null"), 'وفيه مفتاح ثلاثي: تلقائي · نهاري · ليلي');
ok(ev("el.menu.querySelector('[data-seg=\"theme\"]').textContent").includes('نهاري'), 'ويظهر فيه «نهاري» صريحًا');
ev("menuAct('seg:theme:1')"); await raf();
ok(ev('S.theme') === 'day' && ev("document.getElementById('screen').className").includes('day'), 'اختيار «نهاري» يبدّل الشاشة فعلًا (class day)');
ok(ev("localStorage.getItem('sabha.theme')") === 'day', 'ويُحفظ الاختيار');
ev("menuAct('seg:theme:2')"); await raf();
ok(ev('S.theme') === 'night' && !ev("document.getElementById('screen').className").includes('day'), 'واختيار «ليلي» يعود للوضع الداكن');
ok(ev("el.menu.textContent").includes('تخفيت الشاشة'), 'واسم مفتاح التخفيض صار «تخفيت الشاشة» (لا يلتبس على المظهر)');
ev("menuAct('seg:theme:0'); closeMenu();"); await raf();

head('🌙 الشاشة الخافتة: اسم الذكر والعدّاد بشكل خافت');
ev("openSetHome(0); S.c = 5; render(); if (!S.aod) toggleAOD();"); await raf();
ok(ev("document.getElementById('aodDhikr').textContent").length > 2, 'اسم الذكر ظاهر في الشاشة الخافتة', ev("document.getElementById('aodDhikr').textContent").slice(0, 20));
ok(ev("document.getElementById('aodNum').textContent") === '5', 'والعدّاد ظاهر فيها');
ok(ev("document.getElementById('aodBar').style.width").endsWith('%') && ev("document.getElementById('aodBar').style.width") !== '0%', 'وشريط تقدّم خافت للنصّ', ev("document.getElementById('aodBar').style.width"));
ev("if (S.aod) toggleAOD(); closeMenu(); goHome();"); await raf();

head('⑨أ التقييم والملاحظات (صفحة «التقييم والملاحظات» في القائمة)');
ev("openMenu('main')"); await raf();
ok(ev("!!el.menu.querySelector('[data-act=\"page:support\"]')"), 'بند «التقييم والملاحظات» ظاهر في الصفحة الرئيسية للقائمة');
ok(ev("el.menu.querySelector('[data-act=\"page:support\"]').textContent").includes('قيّم'),
   'وبجانبه شرح مختصر (قيّم · أرسل ملاحظة)');
ev("menuAct('page:support')"); await raf();
ok(ev('S.page') === 'support' && ev('PAGE_TITLE.support') === 'التقييم والملاحظات', 'الضغط عليه يفتح صفحة التقييم والملاحظات');
const supLinks = ['rate', 'supportMail'].filter(a => ev(`!!el.menu.querySelector('[data-act="${a}"]')`));
ok(supLinks.length === 2, 'وفيها زرّان: «قيّم التطبيق على App Store» و«أرسل ملاحظة أو اقتراحًا»', supLinks.join(' · '));
ok(ev("el.menu.textContent").includes('الآيفون'), 'وتوضيح أن التقييم والكتابة يكونان على الآيفون (قيد watchOS)');
ok(ev("el.menu.textContent").includes('١٫٠'), 'وسطر التشخيص يحمل رقم الإصدار (يسهّل تتبّع الملاحظة)');
ev("menuAct('rate')"); await raf();
ok(ev("el.toast.textContent").includes('الآيفون'), 'زرّ التقييم يوضّح أنه يُفتح على الآيفون', ev('el.toast.textContent'));
ok(ev('S.page') === 'support', 'والصفحة تبقى مفتوحة بعد النقر (لا خروج مفاجئ)');
ev("menuAct('supportMail')"); await raf();
ok(ev("el.toast.textContent").includes('ملاحظتك'), 'وزرّ الملاحظة يؤكّد الإرسال برسالة');
ev("menuAct('page:main')"); await raf();
ok(ev('S.page') === 'main', 'وزر الرجوع ‹ يرجع للصفحة الرئيسية');

head('⑨ النصوص الكاملة');
ok(ev("FULL['آيَةُ الْكُرْسِيّ'].length") === 462, 'آية الكرسي كاملة (٤٦٢ حرفًا مع ملاحظة موضعها)');
ok(ev("FULL['آيَةُ الْكُرْسِيّ'].startsWith('اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ')")
   && ev("FULL['آيَةُ الْكُرْسِيّ'].includes('وَهُوَ الْعَلِيُّ الْعَظِيمُ')"), 'آية الكرسي من أولها إلى آخرها');
ok(ev('Object.keys(FULL).length') === 45, '٤٥ نصًا كاملًا (مطابق لـ Swift) — بعد مطابقة حصن المسلم');

console.log(`\n${'─'.repeat(58)}`);
console.log(`  النتيجة: ${pass} ✔ · ${fail} ✘`);
process.exit(fail ? 1 : 0);
