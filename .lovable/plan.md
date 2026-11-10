# GitHub Entegrasyon Durumu — Tespit ve Güvenli Yol

## Tespit (salt-okunur kontrol)
- Sandbox'taki kod yalnızca Lovable'ın kendi iç deposuna bağlı; GitHub adresi görünmüyor. Çalışma dalı Lovable'ın geçici düzenleme dalı (`edit/...`).
- Lovable'ın GitHub bağlantısı sandbox'tan okunamaz; gerçek durum yalnızca **Project settings → Git** ekranında görünür. Orada "Connect" görünüyorsa proje bağlı değildir.

## `semihtoktas2018-byte/signal-magic-grab` + `fix/signal-entry-and-performance` bağlanabilir mi?
- **Var olan bir depoyu bağlamak mümkün değil.** Lovable bağlantıda her zaman yeni, özel bir depo oluşturur; mevcut depo bağlanamaz.
- Lovable yalnızca senkron daldaki (varsayılan dal) değişiklikleri alır; diğer dallar Lovable'a gelmez.

## En güvenli yol (yayını bozmadan)
1. Project settings → Git'te durumu kontrol edin.
2. Bağlı değilse "Connect" ile Lovable yeni bir depo oluşturur ve mevcut kodu oraya gönderir (proje ve yayın etkilenmez).
3. Yerelde `fix/signal-entry-and-performance` dalını bu yeni depoya gönderin (ayrı dal olarak; senkron dala değil).
4. Yeni depoda bu daldan senkron dala PR açın, farkları inceleyin. Merge edildiğinde değişiklik Lovable'a gelir — yayına ancak siz Publish'e bastığınızda çıkar.
5. Alternatif (daha da kontrollü): dalın değişikliklerini bana parça parça verin, onları burada ayrı bir taslakta uygulayalım.

## Dikkat
- Senkron dala force-push/rebase yapmayın: Lovable'daki çalışma `lovable-sync` dalına itilir ve sürüm değiştirilir.
- Daldaki `supabase/migrations` dosyaları otomatik uygulanmaz; ayrıca sohbetten istenmeli.
- Bu adımlarda dosya, secret, migration veya yayın değişikliği yapılmaz.
