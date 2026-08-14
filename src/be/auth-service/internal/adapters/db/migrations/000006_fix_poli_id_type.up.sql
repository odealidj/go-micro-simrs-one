ALTER TABLE mapping_dokter_poli DROP CONSTRAINT mapping_dokter_poli_pkey;
ALTER TABLE mapping_dokter_poli ALTER COLUMN poli_id TYPE VARCHAR(50);
ALTER TABLE mapping_dokter_poli RENAME COLUMN poli_id TO poli_code;
ALTER TABLE mapping_dokter_poli ADD PRIMARY KEY (dokter_id, poli_code);

ALTER TABLE mapping_perawat_poli DROP CONSTRAINT mapping_perawat_poli_pkey;
ALTER TABLE mapping_perawat_poli ALTER COLUMN poli_id TYPE VARCHAR(50);
ALTER TABLE mapping_perawat_poli RENAME COLUMN poli_id TO poli_code;
ALTER TABLE mapping_perawat_poli ADD PRIMARY KEY (perawat_id, poli_code);

ALTER TABLE jadwal_praktek ALTER COLUMN poli_id TYPE VARCHAR(50);
ALTER TABLE jadwal_praktek RENAME COLUMN poli_id TO poli_code;
