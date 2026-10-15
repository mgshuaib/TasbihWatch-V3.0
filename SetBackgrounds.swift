//
//  SetBackgrounds.swift
//  سبحة — خلفيات خافتة متناسقة مع كل مجموعة أذكار
//
//  التصميم: لغة بصرية واحدة لكل المجموعات (فحمي/تركوازي داكن + توهّج هادئ)،
//  ويتغيّر الرمز فقط بحسب المجموعة — فتبقى الواجهة متّسقة ومريحة للعين.
//
//  الصور موجودة في مجلد الأصول: SetBackground_<id>
//  (كل صور بنسبة مربعة 312×312 و @2x = 624×624، ووزنها ~٤ ك.ب للصورة)
//

import SwiftUI

// MARK: - الربط بين المجموعة والخلفية

enum SetBackground {

    /// اسم الصورة في مجلد الأصول لكل معرّف مجموعة
    private static let map: [String: String] = [
        "after_prayer": "SetBackground_after_prayer",
        "morning":      "SetBackground_morning",
        "evening":      "SetBackground_evening",
        "sleep":        "SetBackground_sleep",
        "general":      "SetBackground_general",
        "free":         "SetBackground_free",
        // المجموعتان الجديدتان تعيدان استخدام خلفيتين من نفس العائلة البصرية
        // (التصميم لغة واحدة متّسقة — فلا نحتاج صورتين جديدتين)
        "istighfar":    "SetBackground_general",
        "salawat":      "SetBackground_evening"
    ]

    static func assetName(for set: DhikrSet) -> String? {
        map[set.id]
    }
}

// MARK: - خلفية التطبيق الأساسية

/// 🖼️ خلفية «سبحة» الأساسية: حلقة سبحة كاملة + وسائل العدّ الثلاث في مواضع متوازية
///    (يد الساعة بالحركة · التاج · نقرة الإصبع · وإشارة دوران)
///    تظهر خلف كل الشاشات (الرئيسية والعدّ معًا)، وخلفية المجموعة تعلوها عند تشغيلها.
///    نسختان حقيقيتان: ورقية دافئة للنهاري · متوهّجة داكنة للّيلي.
struct AppBackgroundView: View {
    var isDay: Bool

    var body: some View {
        Image(isDay ? "AppBackgroundDay" : "AppBackgroundNight")   // 🌞 نسخة ورقية · 🌙 نسخة متوهّجة
            .resizable()
            .scaledToFill()
            .opacity(isDay ? 0.9 : 0.75)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }
}

// MARK: - طبقة الخلفية

/// تُوضع خلف محتوى الشاشة: صورة خافتة + تظليل مركزي كي يبقى النص مقروءًا.
struct SetBackgroundView: View {

    let setId: String
    var isOn: Bool
    var opacity: Double          // 0.35 خافتة · 0.55 متوسطة · 0.78 واضحة
    /// ☀️ الوضع النهاري: صورة أخفّ وستارة **فاتحة** بدل السوداء
    ///    (كانت الستارة السوداء تجعل الشاشة تبدو ليلية حتى في وضح النهار)
    var isDay: Bool = false

    init(set: DhikrSet, isOn: Bool, opacity: Double, isDay: Bool = false) {
        self.setId   = set.id
        self.isOn    = isOn
        self.opacity = opacity
        self.isDay   = isDay
    }

    private var asset: String { "SetBackground_\(setId)" }

    var body: some View {
        ZStack {
            if isOn {
                // الصورة (تُرسم بحجم الشاشة كاملًا مع قصّ)
                Image(asset)
                    .resizable()
                    .scaledToFill()
                    // ☀️ النهار: نعكس الصورة إلى نسخة **فاتحة** بنفس ألوانها (عكس + تدوير الصبغة ١٨٠°)
                    //    فتظهر الخلفية بوضوح ويبقى النصّ الكربوني مقروءًا — نفس ما يفعله المحاكي بالفلتر
                    .colorInvert(if: isDay)
                    .hueRotation(.degrees(isDay ? 180 : 0))
                    .brightness(isDay ? 0.06 : 0)
                    .saturation(isDay ? 0.8 : 1)
                    .contrast(isDay ? 0.95 : 1)
                    .opacity(isDay ? opacity : opacity)
                    .blur(radius: 0.3)                 // تنعيم خفيف جدًا: لا يشوّش النص
                    .ignoresSafeArea()

                // تظليل متدرّج: الشفافية وسط الشاشة حتى لا تُرهق العين، وعتمة/إضاءة عند الحواف
                RadialGradient(
                    gradient: Gradient(colors: isDay
                        ? [Color.white.opacity(0.06), Color.white.opacity(0.44), Color.white.opacity(0.66)]
                        : [Color.black.opacity(0.18), Color.black.opacity(0.55), Color.black.opacity(0.78)]),
                    center: .center,
                    startRadius: 10,
                    endRadius: 170
                )
                .ignoresSafeArea()

                // تعتيم إضافي في الوضع الليلي
                Color.black.opacity(0.0)
                    .ignoresSafeArea()
            }
        }
        .animation(.easeInOut(duration: 0.6), value: isOn)   // تبديل ناعم للخلفية
        .animation(.easeInOut(duration: 0.6), value: setId)
        .allowsHitTesting(false)                              // لا تعترض اللمس ولا الإيماءة
    }
}

// MARK: - تعديل جاهز للاستخدام

extension View {

    /// يرسم خلفية المجموعة خلف أي واجهة
    func withSetBackground(_ set: DhikrSet,
                           isOn: Bool,
                           opacity: Double,
                           isDay: Bool = false) -> some View {
        ZStack {
            isDay ? Color(red: 0.965, green: 0.949, blue: 0.914) : Color.black
            SetBackgroundView(set: set, isOn: isOn, opacity: opacity, isDay: isDay)
            self
        }
    }
}

// MARK: - أدوات

extension View {
    /// عكس الألوان بشرط (SwiftUI لا يوفّر colorInvert(if:) أصلًا)
    @ViewBuilder
    func colorInvert(if condition: Bool) -> some View {
        if condition { self.colorInvert() } else { self }
    }
}
