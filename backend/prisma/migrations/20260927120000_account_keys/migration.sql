-- Enkripsi akun: kunci ruang disimpan di akun dalam bentuk terbungkus, ditambah
-- parameter turunan kunci dan verifier kode pemulihan pada tabel pengguna.
-- Server tidak bisa membuka bungkusan kunci karena tidak memegang kunci turunan
-- kata sandi maupun kode pemulihan.

ALTER TABLE "users" ADD COLUMN "kdf_salt" TEXT;
ALTER TABLE "users" ADD COLUMN "kdf_iterations" INTEGER;
ALTER TABLE "users" ADD COLUMN "recovery_hash" TEXT;

CREATE TABLE "room_keys" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "wrapped_password" TEXT NOT NULL,
    "wrapped_recovery" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_keys_room_id_key" ON "room_keys"("room_id");

ALTER TABLE "room_keys" ADD CONSTRAINT "room_keys_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
