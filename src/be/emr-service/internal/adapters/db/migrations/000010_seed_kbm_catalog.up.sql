-- Seed data KBM (Kamus Bahasa Medis) — istilah medis Indonesia untuk Poliklinik
INSERT INTO kbm_catalog (kbm_code, kbm_name, description, body_system) VALUES
-- Sistem Pencernaan
('KBM-001', 'Demam Tifoid',              'Infeksi bakteri Salmonella typhi pada saluran cerna',         'Sistem Pencernaan'),
('KBM-002', 'Diare Akut',                'Buang air besar cair >3x/hari mendadak',                      'Sistem Pencernaan'),
('KBM-003', 'Gastritis',                 'Peradangan pada lapisan lambung',                             'Sistem Pencernaan'),
('KBM-004', 'Tukak Lambung',             'Luka terbuka pada lapisan lambung atau duodenum',             'Sistem Pencernaan'),
('KBM-005', 'Konstipasi',                'Kesulitan buang air besar / feses keras',                    'Sistem Pencernaan'),
('KBM-006', 'Mual Muntah',               'Rasa tidak nyaman di perut disertai dorongan muntah',         'Sistem Pencernaan'),
('KBM-007', 'Wasir / Hemoroid',          'Pembengkakan pembuluh darah di rektum atau anus',             'Sistem Pencernaan'),
('KBM-008', 'Hepatitis Akut',            'Peradangan hati akut oleh virus atau penyebab lain',          'Sistem Pencernaan'),

-- Sistem Pernapasan
('KBM-011', 'ISPA',                      'Infeksi Saluran Pernapasan Atas (pilek, radang tenggorokan)', 'Sistem Pernapasan'),
('KBM-012', 'Bronkitis Akut',            'Peradangan pada saluran bronkus secara mendadak',             'Sistem Pernapasan'),
('KBM-013', 'Pneumonia',                 'Infeksi / peradangan pada jaringan paru-paru',                'Sistem Pernapasan'),
('KBM-014', 'Asma Bronkial',             'Penyempitan saluran napas kronis bersifat reversibel',        'Sistem Pernapasan'),
('KBM-015', 'Tuberkulosis Paru',         'Infeksi Mycobacterium tuberculosis pada paru',                'Sistem Pernapasan'),
('KBM-016', 'Batuk Kronis',              'Batuk berlangsung lebih dari 3 minggu',                       'Sistem Pernapasan'),
('KBM-017', 'Faringitis',                'Peradangan pada tenggorokan (faring)',                        'Sistem Pernapasan'),

-- Sistem Kardiovaskular
('KBM-021', 'Hipertensi',                'Tekanan darah tinggi (sistolik ≥140 atau diastolik ≥90)',     'Sistem Kardiovaskular'),
('KBM-022', 'Gagal Jantung',             'Jantung tidak mampu memompa darah secara adekuat',            'Sistem Kardiovaskular'),
('KBM-023', 'Angina Pektoris',           'Nyeri dada akibat kurangnya suplai darah ke jantung',         'Sistem Kardiovaskular'),
('KBM-024', 'Aritmia Jantung',           'Gangguan irama jantung (terlalu cepat, lambat, tidak teratur)','Sistem Kardiovaskular'),

-- Sistem Endokrin & Metabolik
('KBM-031', 'Diabetes Mellitus Tipe 2',  'Gangguan metabolisme gula darah kronis pada dewasa',          'Sistem Endokrin'),
('KBM-032', 'Diabetes Mellitus Tipe 1',  'Gangguan metabolisme gula darah akibat autoimun',             'Sistem Endokrin'),
('KBM-033', 'Hipotiroid',                'Kelenjar tiroid kurang aktif memproduksi hormon',             'Sistem Endokrin'),
('KBM-034', 'Hipertiroid',               'Kelenjar tiroid terlalu aktif memproduksi hormon',            'Sistem Endokrin'),
('KBM-035', 'Obesitas',                  'Kelebihan lemak tubuh dengan BMI ≥30',                        'Sistem Endokrin'),
('KBM-036', 'Asam Urat Tinggi',          'Kadar asam urat berlebih dalam darah (hiperurisemia)',        'Sistem Endokrin'),
('KBM-037', 'Kolesterol Tinggi',         'Kadar kolesterol/trigliserida melebihi nilai normal',         'Sistem Endokrin'),

-- Sistem Muskuloskeletal
('KBM-041', 'Nyeri Punggung Bawah',      'Nyeri pada regio lumbal, bisa akut atau kronis',              'Sistem Muskuloskeletal'),
('KBM-042', 'Osteoartritis',             'Kerusakan tulang rawan sendi akibat degenerasi',              'Sistem Muskuloskeletal'),
('KBM-043', 'Rheumatoid Artritis',       'Peradangan sendi kronis akibat autoimun',                    'Sistem Muskuloskeletal'),
('KBM-044', 'Fraktur',                   'Patah tulang akibat trauma atau penyakit',                    'Sistem Muskuloskeletal'),
('KBM-045', 'Keseleo / Sprain',          'Robekan ligamen akibat gerakan tiba-tiba',                    'Sistem Muskuloskeletal'),

-- Sistem Saraf
('KBM-051', 'Migrain',                   'Sakit kepala berulang sebelah, berdenyut, dengan aura',       'Sistem Saraf'),
('KBM-052', 'Vertigo',                   'Sensasi berputar atau tidak seimbang',                        'Sistem Saraf'),
('KBM-053', 'Neuropati Perifer',         'Kerusakan saraf tepi, sering pada penderita DM',              'Sistem Saraf'),
('KBM-054', 'Insomnia',                  'Gangguan tidur — sulit tidur atau tidur tidak nyenyak',       'Sistem Saraf'),

-- Kulit
('KBM-061', 'Dermatitis Alergi',         'Peradangan kulit akibat reaksi alergi',                       'Sistem Integumen'),
('KBM-062', 'Urtikaria / Biduran',       'Ruam kulit kemerahan disertai gatal akut',                    'Sistem Integumen'),
('KBM-063', 'Psoriasis',                 'Penyakit kulit kronis dengan plak merah bersisik',            'Sistem Integumen'),
('KBM-064', 'Scabies',                   'Infeksi kulit oleh tungau Sarcoptes scabiei',                  'Sistem Integumen'),

-- Umum
('KBM-071', 'Demam Tidak Spesifik',      'Suhu tubuh >38°C tanpa penyebab yang jelas',                  'Umum'),
('KBM-072', 'Anemia',                    'Kadar hemoglobin darah di bawah normal',                      'Umum'),
('KBM-073', 'Dehidrasi',                 'Kekurangan cairan tubuh',                                     'Umum')
ON CONFLICT (kbm_code) DO NOTHING;
