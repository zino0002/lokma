# Lokma Supabase kurulumu

1. Supabase projesinde **SQL Editor** bölümünü açıp güncel [`schema.sql`](./schema.sql) dosyasının tamamını çalıştır. Bu, `user_kitchens` ve `user_account_status` tablolarını, RLS kurallarını ve yeni hesap durumu RPC'sini kurar. SQL tekrar çalıştırılabilir.
2. Supabase **Authentication → URL Configuration** bölümünde uygulamanın çalışacağı adresi **Site URL** olarak ayarla. E-posta doğrulaması açıksa bu adrese geri dönüşe izin ver.
3. Uygulamayı `file://` yerine bir web sunucusu üzerinden aç. Örneğin VS Code'daki Live Server ile `index.html` dosyasını sun.
4. Supabase URL'si ve publishable key, statik uygulamanın tarayıcıda kullanması için [`app.js`](../app.js) içinde tanımlıdır. Publishable key herkese açık istemci anahtarıdır; `service_role` veya gizli anahtar kullanma.

Kullanıcı kayıtları Supabase Auth'ta, tarifler ve haftalık plan `user_kitchens` tablosunda, hesabın geçici açık/kapalı durumu ise `user_account_status` tablosunda saklanır. RLS politikaları kullanıcıların yalnızca kendi mutfak verilerine erişmesini sağlar ve hesabı kapalıyken mutfak verilerine erişimi engeller. Profil düğmesinden oturumu kapatabilir, parolayı değiştirebilir veya hesabı geçici kapatıp yeniden açabilirsin. Eski tarayıcı verileri olan bir cihazda ilk girişte, bu verileri hesaba aktarmak isteyip istemediğin sorulur.
