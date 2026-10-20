# Lokma

Lokma, haftalık yemek planı oluşturmanı, tariflerini kategorilere ayırmanı ve bunları Supabase ile güvenli şekilde senkronize etmeni sağlayan hafif bir web uygulamasıdır.

## Özellikler

- Haftalık plan görünümü
- Tarif ekleme, düzenleme ve silme
- Kategori bazlı tarif organizasyonu
- Günlük/haftalık öğün takibi
- Tamamlandı işaretleme
- Yerel önbellek + bulut senkronizasyon
- Supabase Auth ile kullanıcı oturumu
- Hesap geçici olarak kapatma / yeniden açma desteği
- Koyu/açık tema desteği

## Teknoloji Yığını

- HTML
- CSS
- JavaScript
- Supabase Auth
- Supabase Postgres (JSONB tablosu)

## Proje Yapısı

- `app.js` — uygulama mantığı, arayüz, veri akışı ve Supabase bağlanması
- `index.html` — arayüz yapısı
- `styles.css` — stiller
- `supabase/schema.sql` — veritabanı ve güvenlik politikaları
- `supabase/SETUP.md` — kurulum adımları

## Hızlı Başlangıç

1. Supabase projesi oluştur.
2. `supabase/schema.sql` dosyasını Supabase SQL Editor içinde çalıştır.
3. `app.js` dosyasındaki `SUPABASE_URL` ve `SUPABASE_PUBLISHABLE_KEY` değerlerini kendi projenize göre ayarla.
4. Uygulamayı bir yerel web sunucusu üzerinden aç.
   - Örnek: VS Code Live Server
5. Hesap oluşturup giriş yap ve tariflerini eklemeye başla.

## Geliştirme Notları

- Uygulama statik bir frontend olduğu için paket kurulumu gerektirmez.
- Kullanıcı verileri `user_kitchens` tablosunda saklanır.
- Hesap durumu `user_account_status` tablosunda tutulur.
- `file://` protokolü yerine ağ üzerinden çalışan bir sunucu önerilir.

## Güvenlik ve Ayarlar

- Publishable key, istemci tarafında kullanılmak üzere tasarlanmıştır.
- RLS (Row Level Security) politikaları, kullanıcıların yalnızca kendi kayıtlarına erişmesini sağlar.
- Supabase Auth URL configuration bölümünde site URL'si doğru ayarlanmalıdır.

## Amaç

Lokma, yemek planlama ve tarif saklama işini sade, hızlı ve kişisel bir deneyim haline getirmeyi hedefler. Özellikle küçük aile mutfakları, günlük menü planlamaları ve tarif defteri kullanımı için uygun bir tasarıma sahiptir.
