import type { Car, Category, Settings, Subscription } from './types';

/** معرّفات التصنيفات الرئيسية الثابتة */
export const CAT = {
  home: 'home',
  groceries: 'groceries',
  restaurants: 'restaurants',
  cars: 'cars',
  education: 'education',
  health: 'health',
  subscriptions: 'subscriptions',
  personal: 'personal',
  entertainment: 'entertainment',
  pets: 'pets',
  charity: 'charity',
  other: 'other',
} as const;

const now = 0;

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: CAT.home, name: 'المنزل والفواتير', icon: 'Home', color: '#3B6EA8', order: 1,
    keywords: ['فاتورة', 'كهرباء', 'الكهرباء', 'فاتورة الماء', 'ماء المنزل', 'انترنت', 'إنترنت', 'واي فاي', 'ايجار', 'إيجار', 'صيانة المنزل', 'سباك', 'كهربائي', 'غاز'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.groceries, name: 'المواد الغذائية والتسوق', icon: 'ShoppingCart', color: '#10B981', order: 2,
    keywords: ['لولو', 'سيف مارت', 'مول مارت', 'مارت', 'ماركت', 'سوبرماركت', 'هايبر', 'اسواق', 'القبائل', 'فواكه', 'خضار', 'خضروات', 'تسوق', 'فيفا', 'ماي', 'رغيف', 'مخبز', 'خبز', 'كارفور', 'نستو', 'مواد استهلاكية'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.restaurants, name: 'المطاعم والمقاهي', icon: 'UtensilsCrossed', color: '#E08A3C', order: 3,
    keywords: ['عشاء', 'عشا', 'عشى', 'غداء', 'غدا', 'غدى', 'ريوق', 'فطور', 'شاي', 'قهوة', 'كافيه', 'مقهى', 'مطعم', 'فلافل', 'سمبوسة', 'برجر', 'بيتزا', 'شاورما', 'تي تايم', 'سوردو', 'نزل الضيافة', 'كرك', 'وجبة'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.cars, name: 'السيارات والنقل', icon: 'Car', color: '#0EA5B7', order: 4,
    keywords: ['بترول', 'وقود', 'بنزين', 'ديزل', 'بطارية السيارة', 'بطارية ريموت', 'غسيل سيارة', 'غسيل السيارة', 'زجاج', 'مكيف', 'تصليح', 'صيانة السيارة', 'تغيير زيت', 'زيت', 'اطارات', 'إطارات', 'تواير', 'كراج', 'ورشة', 'قطع غيار', 'تأمين السيارة', 'ملكية', 'مواقف', 'تاكسي', 'سيارة'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.education, name: 'التعليم والأطفال', icon: 'GraduationCap', color: '#D6AC59', order: 5,
    keywords: ['مدرسة', 'المدرسة', 'الأطفال', 'اطفال', 'قرطاسية', 'دورة', 'رسوم دراسية', 'حقيبة', 'زي مدرسي', 'كتب'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.health, name: 'الصحة', icon: 'HeartPulse', color: '#E25563', order: 6,
    keywords: ['مستشفى', 'مستشفي', 'عيادة', 'صيدلية', 'الصيدلية', 'تحاليل', 'تحليل', 'دواء', 'علاج', 'بدر السماء', 'طبيب', 'اسنان'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.subscriptions, name: 'الاشتراكات الرقمية', icon: 'Repeat', color: '#8B5CF6', order: 7,
    keywords: ['اشتراك', 'انثروبيك', 'كلود', 'claude', 'anthropic', 'شات جي بي', 'شات جي بي تي', 'chatgpt', 'openai', 'جيمني', 'جيميني', 'gemini', 'جوجل بلاي', 'google play', 'نتفلكس', 'netflix', 'شاهد', 'سبوتيفاي', 'spotify', 'icloud', 'يوتيوب'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.personal, name: 'العناية الشخصية', icon: 'Sparkles', color: '#D96BA8', order: 8,
    keywords: ['حلاق', 'حلاقة', 'عطور', 'عطر', 'ملابس', 'فاشن', 'بوتيك', 'بويتيك', 'سنتر بوينت', 'ماكس', 'مركز الشهباء', 'غسيل ملابس', 'مغسلة', 'احذية', 'دشداشة'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.entertainment, name: 'الترفيه', icon: 'Gamepad2', color: '#84A93C', order: 9,
    keywords: ['بليارد', 'بلياردو', 'العاب', 'ألعاب', 'رحلة', 'سينما', 'ملاهي', 'نزهة', 'بولينج'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.pets, name: 'الحيوانات الأليفة', icon: 'PawPrint', color: '#B45309', order: 10,
    keywords: ['السنانير', 'سنانير', 'سنور', 'قطط', 'قطة', 'بسة', 'بسس', 'اكل القطط', 'بيطري'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.charity, name: 'الصدقات والتبرعات', icon: 'HandHeart', color: '#0F766E', order: 11,
    keywords: ['صدقة', 'صدقه', 'تبرع', 'زكاة', 'مساعدة'],
    builtin: true, parentId: null,
  },
  {
    id: CAT.other, name: 'أخرى', icon: 'CircleDashed', color: '#94A3B8', order: 12,
    keywords: [],
    builtin: true, parentId: null,
  },
];

/** لا توجد سيارات افتراضية في النسخة العامة؛ يضيفها المستخدم من شاشة الترحيب أو صفحة السيارات */
export const DEFAULT_CARS: Car[] = [];

/** أمثلة تُستخدم في الاختبارات فقط */
export const SAMPLE_CARS: Car[] = [
  { id: 'car-is', name: 'Lexus IS', aliases: ['أي أس', 'اي اس', 'IS'], plate: '', year: '', color: '', image: null, notes: '', createdAt: now },
  { id: 'car-rx', name: 'Lexus RX', aliases: ['أر أكس', 'ار اكس', 'RX'], plate: '', year: '', color: '', image: null, notes: '', createdAt: now },
];

/** اشتراكات أمثلة بلا مبالغ مفترضة؛ يحدد المستخدم المبلغ والتجديد */
export const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  { id: 'sub-claude', name: 'Claude', amount: null, cycle: 'monthly', nextRenewal: null, status: 'active', categoryId: CAT.subscriptions, keywords: ['كلود', 'انثروبيك', 'claude', 'anthropic'], remindDays: 3, createdAt: now },
  { id: 'sub-chatgpt', name: 'ChatGPT', amount: null, cycle: 'monthly', nextRenewal: null, status: 'active', categoryId: CAT.subscriptions, keywords: ['شات جي بي', 'chatgpt', 'openai'], remindDays: 3, createdAt: now },
  { id: 'sub-gemini', name: 'Gemini', amount: null, cycle: 'monthly', nextRenewal: null, status: 'active', categoryId: CAT.subscriptions, keywords: ['جيمني', 'جيميني', 'gemini'], remindDays: 3, createdAt: now },
  { id: 'sub-gplay', name: 'Google Play', amount: null, cycle: 'monthly', nextRenewal: null, status: 'active', categoryId: CAT.subscriptions, keywords: ['جوجل بلاي', 'google play'], remindDays: 3, createdAt: now },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  userName: '',
  theme: 'system',
  currentPeriodId: null,
  anomalyFactor: 10,
  seeded: false,
  onboarded: false,
};

export const CATEGORY_PALETTE = ['#3B6EA8', '#10B981', '#E08A3C', '#0EA5B7', '#D6AC59', '#E25563', '#8B5CF6', '#D96BA8', '#84A93C', '#A0785A', '#5FA8D3', '#94A3B8', '#C2410C', '#0F766E', '#7C3AED', '#BE185D'];

export const CATEGORY_ICONS = ['Home', 'ShoppingCart', 'UtensilsCrossed', 'Car', 'GraduationCap', 'HeartPulse', 'Repeat', 'Sparkles', 'Gamepad2', 'PawPrint', 'HandHeart', 'CircleDashed', 'Plane', 'Gift', 'Baby', 'Shirt', 'Wrench', 'Smartphone', 'Briefcase', 'Coffee', 'Fuel', 'Dumbbell', 'BookOpen', 'Landmark'];
