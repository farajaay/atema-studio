import type { Package, AddOn } from '../types';

// ===== PACKAGES DATA =====
export const PACKAGES: Package[] = [
  {
    id: 1,
    nameAr: 'جلسة الخطوبة',
    nameEn: 'Engagement Session',
    price: 1855,
    durationHours: 2,
    editedPhotos: 30,
    album: 'Save the Date رقمي',
    video: false,
    description: 'ساعتان من التصوير الاحترافي',
    features: [
      '30 صورة معدلة',
      'وحدة تخزين رقمية',
      'اختيار أجمل اللقطات',
      'Save the Date رقمي'
    ],
    badge: 'الأساسي'
  },
  {
    id: 2,
    nameAr: 'الباقة المخصصة',
    nameEn: 'Customise',
    price: 2200,
    durationHours: 3,
    editedPhotos: 50,
    album: 'صور JPG مع معالجة',
    video: false,
    description: 'تغطية شاملة للحفل',
    features: [
      'تغطية فوتوغرافية شاملة',
      'جميع الصور بصيغة JPG',
      'وحدة تخزين رقمية',
      'معالجة احترافية'
    ],
    badge: 'محبوب'
  },
  {
    id: 3,
    nameAr: 'الباقة الكلاسيكية',
    nameEn: 'Classic',
    price: 4200,
    durationHours: 4,
    editedPhotos: 80,
    album: 'ألبوم A4 بـ 10 صفحات',
    video: false,
    description: 'تصوير شامل مع ألبوم فاخر',
    features: [
      'تغطية فوتوغرافية شاملة',
      'ألبوم A4 بـ 10 صفحات',
      '5 صور عائلية معدلة',
      'وحدة تخزين بجميع الصور'
    ]
  },
  {
    id: 4,
    nameAr: 'الباقة الملكية',
    nameEn: 'Royal',
    price: 6900,
    durationHours: 5,
    editedPhotos: 100,
    album: 'ألبوم فاخر + ميني ألبوم',
    video: true,
    description: 'تصوير كامل مع فيديو سينمائي',
    features: [
      'تغطية فوتوغرافية شاملة',
      'فيديو سينمائي قصير (3-5 دقائق)',
      'ألبوم 4A بـ 10 صفحات + ميني',
      'معاينة نفس اليوم'
    ],
    badge: 'الأعلى',
    isPopular: true
  },
  {
    id: 5,
    nameAr: 'باقة التوقيع',
    nameEn: 'Signature',
    price: 8500,
    durationHours: 6,
    editedPhotos: 120,
    album: 'ألبوم فاخر 3A + ميني',
    video: true,
    description: 'تجربة متكاملة فوتو + فيديو',
    features: [
      'فوتوغراف + فيديو سينمائي كامل',
      'جلسة تحضيرات العروس',
      'ألبوم فاخر 3A بـ 12 صفحة + ميني',
      'معاينة نفس اليوم + متابعة خاصة'
    ],
    badge: 'فاخر'
  },
  {
    id: 6,
    nameAr: 'ATEMA Couture',
    nameEn: 'ATEMA Couture',
    price: 14000,
    durationHours: 7,
    editedPhotos: 150,
    album: 'لوحة جدارية مؤطرة + ألبوم',
    video: true,
    description: 'تجربة الفخامة الكاملة',
    features: [
      'تغطية كاملة + فيديو سينمائي فاخر',
      'جلسة تحضيرات + ليلة الحناء',
      'ألبوم 3A فاخر + لوحة جدارية مؤطرة',
      'معاينة + متابعة خاصة مميزة'
    ],
    badge: 'برميوم'
  }
];

// ===== ADD-ONS DATA =====
export const ADDONS: AddOn[] = [
  {
    id: 'extra-hour',
    iconEmoji: '⏱',
    nameAr: 'ساعة إضافية',
    nameEn: 'Extra Hour',
    price: 500
  },
  {
    id: 'extra-photos',
    iconEmoji: '📸',
    nameAr: 'صور إضافية (25)',
    nameEn: 'Extra Photos (25)',
    price: 600
  },
  {
    id: 'drone',
    iconEmoji: '🚁',
    nameAr: 'تصوير جوي (Drone)',
    nameEn: 'Drone Footage',
    price: 1000
  },
  {
    id: 'express-delivery',
    iconEmoji: '⚡',
    nameAr: 'معالجة سريعة (24h)',
    nameEn: 'Express Processing',
    price: 300
  },
  {
    id: 'album-print',
    iconEmoji: '📖',
    nameAr: 'ألبوم مطبوع',
    nameEn: 'Printed Album',
    price: 800
  },
  {
    id: 'extra-video',
    iconEmoji: '🎥',
    nameAr: 'فيديو إضافي',
    nameEn: 'Extra Video',
    price: 1500
  }
];

// ===== CITIES =====
export const CITIES = [
  { code: 'jubail', nameAr: 'الجبيل', nameEn: 'Jubail' },
  { code: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam' },
  { code: 'khobar', nameAr: 'الخبر', nameEn: 'Khobar' },
  { code: 'qatif', nameAr: 'القطيف', nameEn: 'Qatif' },
  { code: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh' },
  { code: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah' },
  { code: 'makkah', nameAr: 'مكة', nameEn: 'Makkah' },
  { code: 'medina', nameAr: 'المدينة', nameEn: 'Medina' }
];

// ===== THEME COLORS =====
// Legacy palette retained for backwards compatibility. Values now point at the
// theme CSS custom properties (set by applyTheme via useTheme), so any element
// styled with these tokens automatically follows the active theme — no rewrite
// required on the consuming components.
export const ATEMA_COLORS = {
  champagne:      'var(--a-gold)',
  warmSand:       'var(--a-gold-deep)',
  deepBronze:     'var(--a-gold-deep)',
  softIvory:      'var(--a-bg)',
  editorialBlack: 'var(--a-heading)',
  lightGray:      'var(--a-surface-alt)',
};

// ===== VAT RATE =====
export const VAT_RATE = 0.15; // 15% Saudi VAT
