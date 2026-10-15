//
//  HomeView.swift
//  سبحة — الشاشة الرئيسية (أيقونات الأذكار)
//
//  لماذا شاشة رئيسية؟ بطلبك: عند فتح التطبيق لا يبدأ العدّ فورًا في «أذكار بعد
//  الصلاة»، بل تظهر أيقونات الأذكار فتختار منها ما شئت. وفيها:
//    ① «متابعة»: تعود لآخر ذكر كنت فيه بنفس الرقم (العدّ محفوظ أصلًا).
//    ② آخر ثلاثة أذكار استخدمتها — بضغطة واحدة.
//    ③ شبكة الأيقونات الثمانية (اضغط أيقونة = ابدأ العدّ).
//    ④ طريقة العدّ: نقرة مزدوجة · حركة الرسغ · نقرة التاج — تُحفظ في ذاكرة الجهاز
//       (SharedKeys.countingMode) فتبقى كما اخترتها في كل مرة تفتح فيها التطبيق.
//  وعند إتمام أي مجموعة تعود إلى هنا بزر ⌂ من شاشة الإتمام.
//

import SwiftUI

struct HomeView: View {

    @Environment(\.sabhaPalette) private var palette   // ☀️🌙 تتبع المظهر المختار

    @ObservedObject var model: CounterModel
    /// ضغط أيقونة مجموعة → ابدأ العدّ
    var onOpenSet: (Int) -> Void
    /// ضغط «متابعة» → ارجع للعدّاد من حيث كان
    var onContinue: () -> Void
    /// فتح الإعدادات من الشاشة الرئيسية (نفس قائمة ☰)
    var onMenu: () -> Void

    /// أسماء قصيرة للأيقونات (الشاشة صغيرة، والاسم الطويل يقصّ)
    private func shortTitle(_ set: DhikrSet) -> String {
        switch set.id {
        case "after_prayer": return "بعد الصلاة"
        case "morning":      return "الصباح"
        case "evening":      return "المساء"
        case "sleep":        return "النوم"
        case "general":      return "متنوعة"
        case "free":         return "تسبيح حرّ"
        case "istighfar":    return "استغفار"
        case "salawat":      return "صلاة على النبي"
        default:             return set.title
        }
    }

    private var columns: [GridItem] {
        [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]
    }

    var body: some View {
        VStack(spacing: 5) {

            // ───── الترويسة: الاسم + إجمالي اليوم + الإعدادات ─────
            HStack(spacing: 5) {
                Button(action: onMenu) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 13.5, weight: .semibold))
                        .frame(width: 26, height: 26)
                        .foregroundStyle(.teal)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("القائمة والإعدادات")

                Text("سُبحة")
                    .font(.system(size: 14, weight: .bold, design: .rounded))

                Spacer(minLength: 2)

                Text("اليوم \(model.s.totalToday)")
                    .accessibilityLabel("عدد الأذكار التي عدّتها اليوم: \(model.s.totalToday) — يبدأ من صفر كل يوم")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .padding(.top, 2)

            // ───── ① متابعة (تظهر فقط إن كان هناك عدّ ناقص) ─────
            if model.hasSavedProgress {
                Button(action: onContinue) {
                    HStack(spacing: 5) {
                        Image(systemName: "play.fill").font(.system(size: 10))
                        VStack(alignment: .leading, spacing: 0) {
                            Text("متابعة")
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                            Text("\(shortTitle(model.set)) · \(model.positionText)")
                                .font(.system(size: 9))
                                .opacity(0.9)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    // 🥇 خلفية **معتمة** (لا شفافة): نقش خلفية التطبيق لا يظهر عبر البطاقة
                    .background(palette.continueFill, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SabhaColor.teal.opacity(0.5), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("متابعة \(model.set.title) من \(model.positionText)")
            }

            // ② «آخرها» **أُلغيت** (قرار المستخدم): الرئيسية أنظف بلاها وتتّسع مساحتها للبطاقات.
            //    التتبّع الداخلي (model.recentSets) يبقى محفوظًا كي يسهل إرجاعها إن أراد.

            // ───── ③ شبكة الأذكار ─────
            ScrollView {
                LazyVGrid(columns: columns, spacing: 6) {
                    ForEach(Array(adhkarSets.enumerated()), id: \.element.id) { index, set in
                        Button { onOpenSet(index) } label: {
                            // 🧩 صفّية: أيقونة كبيرة يمينًا · الاسم والعدّ يسارًا (أوضح ما يكون)
                            HStack(spacing: 6) {
                                VStack(alignment: .trailing, spacing: 1) {
                                    Text(shortTitle(set))
                                        .font(.system(size: 10, weight: .semibold))
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.75)
                                    Text(set.totalCount > 0 ? "\(set.items.count) أذكار" : "بلا حد")
                                        .font(.system(size: 8))
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                .frame(maxWidth: .infinity, alignment: .trailing)
                                Image(systemName: set.symbol)
                                    .font(.system(size: 21, weight: .medium))     // 🔍 أكبر مما كان (١٧)
                                    .foregroundStyle(.teal)
                                    .frame(width: 24)
                            }
                            .padding(.horizontal, 7)
                            .padding(.vertical, 7)
                            .background(palette.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(palette.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(set.title) — \(set.items.count) أذكار")
                    }
                }
                .padding(.bottom, 4)
            }

            // ───── ④ طريقة العدّ: نقرة · حركة · تاج (تُحفظ فتبقى عند كل فتح للتطبيق) ─────
            HStack(spacing: 3) {
                Text("طريقة العدّ")
                    .font(.system(size: 8))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)

                ForEach([CountingMode.doubleTap, .motion, .crown], id: \.rawValue) { mode in
                    Button { model.setCountingMode(mode) } label: {
                        HStack(spacing: 2) {
                            Image(systemName: mode.symbol).font(.system(size: 8))
                            Text(mode.shortLabel)
                                .font(.system(size: 8, weight: model.countingMode == mode ? .bold : .regular))
                        }
                        // ✅ المفعّلة: ملء بلون الأيقونات نفسه (تيل) ونصّ داكن يتباين معه — فلا لبس أيّ طريقة تعمل الآن
                        .foregroundStyle(model.countingMode == mode ? Color.black.opacity(0.82) : Color.primary)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(model.countingMode == mode ? SabhaColor.teal
                                                               : palette.surface, in: Capsule())
                        .overlay(Capsule().stroke(model.countingMode == mode ? SabhaColor.teal
                                                                             : palette.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("العدّ بال\(mode.label)")
                }
                Spacer(minLength: 0)
            }

            Text(model.countingMode.worksWhenDim
                 ? "العدّ بال\(model.countingMode.shortLabel) — يعمل والشاشة خافتة ✓"
                 : "النقرة المزدوجة تحتاج شاشة مضيئة")
                .font(.system(size: 8))
                .foregroundStyle(model.countingMode.worksWhenDim ? Color.teal : Color.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 8)
    }
}
