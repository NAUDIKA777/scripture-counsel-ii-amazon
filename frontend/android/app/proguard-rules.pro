# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---- RevenueCat (Google Play build) ----------------------------------------
# minifyEnabled is currently false, so these only take effect if R8 shrinking
# is turned back on. They keep R8 from failing on RevenueCat's Kotlin
# metadata and on optional classes it references but doesn't ship.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class kotlin.Metadata { *; }
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**
-dontwarn kotlinx.coroutines.**
-dontwarn org.jetbrains.annotations.**
