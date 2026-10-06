/* ============================================================================
   ISNAD — interface strings and locale formatting. Arabic is the default.

   Every word the interface shows lives here, in both languages, under one key.
   A key with an object value is a plural: Intl.PluralRules picks the form
   (Arabic has six: zero, one, two, few, many, other), and {n} is formatted
   with the reader's numeral system.

   Rules the Arabic copy keeps, like the English copy:
   - A match status is textual correspondence only. It is never worded as a
     hadith grade, an authenticity ruling, or a fatwa.
   - A failed check is never worded as "not found", and nothing absent from
     the checked edition is ever called fabricated (موضوع).
   ========================================================================= */
(function (global) {
  'use strict';

  const CATALOG = {
    ar: {
      'app.name': 'إسناد',
      'app.title': 'إسناد — محادثة بنصوص موثّقة المصدر',
      'app.tagline': 'توثيق نصوص القرآن والحديث',

      'nav.label': 'التنقل الرئيسي',
      'nav.chat': 'المحادثات',
      'nav.dashboard': 'لوحة المتابعة',
      'nav.newChat': 'محادثة جديدة',
      'nav.collapse': 'طيّ الشريط الجانبي',
      'nav.show': 'إظهار المحادثات',
      'nav.conversations': 'المحادثات المحفوظة',
      'nav.search': 'ابحث في المحادثات…',
      'nav.searchLabel': 'البحث في المحادثات',
      'nav.clearSearch': 'مسح البحث',
      'nav.settings': 'الإعدادات',
      'nav.settingsSub': 'النموذج · الواجهة البرمجية · المظهر',
      'nav.openDashboard': 'فتح لوحة المتابعة',
      'nav.openChat': 'العودة إلى المحادثة',

      'group.today': 'اليوم',
      'group.yesterday': 'أمس',
      'group.week': 'آخر ٧ أيام',
      'group.year': 'في وقت سابق من هذا العام',
      'group.older': 'أقدم',
      'list.empty': 'لا توجد محادثات بعد',
      'list.noMatch': 'لا توجد محادثات مطابقة',
      'list.matches': {
        zero: 'لا محادثة مطابقة من {total}',
        one: 'محادثة واحدة مطابقة من {total}',
        two: 'محادثتان مطابقتان من {total}',
        few: '{n} محادثات مطابقة من {total}',
        many: '{n} محادثة مطابقة من {total}',
        other: '{n} محادثة مطابقة من {total}'
      },
      'list.delete': 'حذف «{title}»',
      'list.deleteShort': 'حذف',
      'list.confirmDelete': 'حذف «{title}» ورسائلها؟ لا يمكن التراجع عن ذلك.',
      'list.deleted': 'حُذفت المحادثة',

      'chat.untitled': 'محادثة جديدة',
      'chat.checkTitle': 'تحقّق · {ref}',
      'chat.badge': 'تحقّق من المصدر',
      'chat.badgeTitle': 'تُطابَق النصوص المقتبسة مع مصادر معتمدة مثبّتة',

      'header.refresh': 'تحديث حالة الاتصال',
      'header.refreshTitle': 'تحديث الاتصال',
      'header.export': 'تصدير المحادثة',
      'header.themeToDark': 'التبديل إلى الوضع الداكن',
      'header.themeToLight': 'التبديل إلى الوضع الفاتح',
      'header.themeTitle': 'تبديل المظهر',
      'header.language': 'English',
      'header.languageLabel': 'Switch to English',
      'header.modelTitle': 'إعدادات النموذج',

      'api.checking': 'الواجهة البرمجية: جارٍ الفحص',
      'api.ready': 'الواجهة البرمجية جاهزة',
      'api.unavailable': 'الواجهة البرمجية غير متاحة',
      'api.thisOrigin': 'أصل هذه الصفحة',
      'api.connectedTo': 'متصل بـ {base}',
      'api.noneConfigured': 'لم تُضبط واجهة برمجية — افتح إعدادات الاتصال',
      'api.version': 'إصدار الواجهة البرمجية {version}',
      'api.unreported': 'غير مُعلَن',
      'api.pairs': 'أزواج المصدر واللغة: {n}',
      'api.editions': 'الإصدارات المحمّلة: {n}',
      'api.promptMissing': 'تعذّر تحميل بروتوكول الاستشهاد — المحادثة معطّلة',
      'api.enterBase': 'أدخل عنوان الواجهة البرمجية في إعدادات الاتصال',
      'api.unreachableHint': 'تعذّر الوصول — راجع العنوان الأساسي وقائمة السماح CORS',
      'api.readinessSilent': 'لم يُجب فحص الجاهزية',

      'model.none': 'لا نموذج',
      'model.noneSelected': 'لم يُختر نموذج',
      'model.endpoint': 'نقطة النموذج {base}',
      'model.keyDevice': 'المفتاح محفوظ على هذا الجهاز',
      'model.keyMemory': 'المفتاح في الذاكرة فقط',
      'model.noKey': 'لا مفتاح',
      'model.openSettings': 'افتح إعدادات النموذج لربط نموذج',

      'mode.label': 'الوضع',
      'mode.chat': 'محادثة',
      'mode.verify': 'تحقّق من نص',

      'verify.source': 'المصدر',
      'verify.language': 'اللغة',
      'verify.reference': 'الموضع',
      'verify.optional': 'اختياري',
      'verify.quran': 'القرآن الكريم',
      'verify.hadith': 'الحديث النبوي',
      'verify.arabic': 'العربية',
      'verify.english': 'الإنجليزية',
      'verify.referencePlaceholder': 'الموضع',

      'composer.label': 'رسالة أو نص مقتبس',
      'composer.placeholderChat': 'اسأل عن أي شيء… تُفحص النصوص المقتبسة قبل أن تراها',
      'composer.placeholderVerify': 'الصق النص المقتبس هنا…',
      'composer.hint': 'Enter للإرسال · Shift+Enter لسطر جديد',
      'composer.hintDefault': 'يمكنك إدخال نص مقتبس، أو موضع في المصدر، أو كليهما.',
      'composer.hintChat': 'يُطلب من النموذج تمييز النصوص المقتبسة مع مواضعها؛ ويمكنه الإجابة عن الأسئلة دون اقتباس.',
      'composer.hintNoAdapter': 'لا يتوفر مُحقِّق لهذا المصدر وهذه اللغة.',
      'composer.hintFormat': 'صيغة الموضع هنا: {format}',
      'composer.hintOptional': 'اختياري. إن ذكرت الموضع قورن النص به، وإلا بُحث عن النص في المصدر كله.',
      'composer.send': 'إرسال',
      'composer.verify': 'تحقّق',
      'composer.stop': 'إيقاف',
      'composer.stopGenerating': 'إيقاف التوليد',
      'composer.verifyTitle': 'التحقق من المصدر المعتمد',
      'composer.configureFirst': 'اربط نموذجًا أولًا',
      'composer.note': 'تُطابَق النصوص المقتبسة مع المصادر المثبّتة. حالة المطابقة تصف التطابق النصي فقط، وليست حكمًا على صحة الحديث ولا فتوى شرعية. تُعرض درجة الحديث ومن حكم بها فقط إذا نصّ عليها المصدر، ولا تستنتجها هذه الواجهة أبدًا. وتعذّر الفحص لا يعني أن النص غير موجود.',

      'validate.empty': 'أدخل نصًا مقتبسًا، أو موضعًا في المصدر، أو كليهما.',
      'validate.tooLong': 'طول النص {length} حرفًا، والحد المسموح {limit}.',
      'validate.refTooLong': 'لا يزيد الموضع على ٦٤ حرفًا.',
      'validate.unsupported': 'لا يتوفر مُحقِّق لـ {pair} في هذا النشر.',

      'empty.chatTitle': 'اسأل عن أي شيء',
      'empty.connectTitle': 'اربط نموذجًا لتبدأ المحادثة',
      'empty.chatSub': 'تتدفّق الإجابات كالمعتاد، وكل آية أو حديث يقتبسه النموذج يُحتجز ويُطابَق مع المصدر المثبّت، ثم يُعرض في بطاقة موثّقة.',
      'empty.connectSub': 'أضف نقطة النموذج ومفتاحه في إعدادات النموذج، وستُضيف هذه الواجهة بروتوكول الاستشهاد تلقائيًا.',
      'empty.fromDisk': 'فُتح هذا الملف من القرص. افتح إعدادات الاتصال وأدخل عنوان واجهة التحقق — لا يمكن فحص النصوص دونه.',
      'empty.apiDown': 'واجهة التحقق غير متاحة، فلا يمكن فحص النصوص المقتبسة الآن. والمحادثة تحتاج إليها؛ فبدونها لا يُوثَق إلا بالنص النثري.',
      'empty.suggestVerse': 'آية',
      'empty.suggestVerseText': 'اذكر سورة الإخلاص مع موضعها.',
      'empty.suggestHadith': 'حديث',
      'empty.suggestHadithText': 'اذكر حديثًا عن النية مع مرجعه.',
      'empty.suggestAsk': 'سؤال',
      'empty.suggestAskText': 'ماذا يقول القرآن عن الصبر؟',
      'empty.verifyTitle': 'تحقّق من نص بنفسك',
      'empty.verifySub': 'الصق آية أو حديثًا مع الموضع الذي أُعطيته، وتأتي النتيجة من بيانات المصدر المثبّتة مع نص المصدر كما هو.',
      'empty.readingCaps': 'جارٍ قراءة {path}…',
      'empty.capsFromDisk': 'فُتح هذا الملف من القرص، فلم تُضبط واجهة برمجية بعد. افتح إعدادات الاتصال وأدخل العنوان الأساسي.',
      'empty.capsDown': 'تعذّر الوصول إلى الواجهة البرمجية، فالمصادر والحدود المدعومة غير معروفة. اضبط العنوان في إعدادات الاتصال ثم حدّث.',
      'empty.apiVersion': 'إصدار الواجهة',
      'empty.statuses': 'الحالات',
      'empty.statusesValue': '{n} نتائج للتطابق النصي',
      'empty.quoteLimit': 'حد النص',
      'empty.quoteLimitValue': '{n} حرف',
      'empty.streaming': 'البث',
      'empty.streamingValue': 'WebSocket {path} · رسائل حتى {n} كيلوبايت',
      'empty.statusGuide': 'ماذا تعني كل حالة',
      'empty.statusGuideNote': 'لا شيء من هذه الحالات درجةً للحديث، ولا حكمًا بصحته، ولا فتوى شرعية.',
      'empty.supported': 'المدعوم في هذا النشر',
      'empty.readiness': 'يُبلغ فحص الجاهزية عن {n} من إصدارات المصادر المحمّلة. وجاهزية المصدر البعيد لا تعني أنه متاح الآن.',

      'status.exact_match.label': 'مطابقة تامة',
      'status.exact_match.meaning': 'النص المُدخل يطابق نص المصدر في الموضع المذكور حرفًا بحرف.',
      'status.normalized_match.label': 'مطابقة بعد توحيد الرسم',
      'status.normalized_match.meaning': 'يطابق النصُّ المصدرَ بعد أن يتجاوز ملفّ التطبيع الخاص بالمصدر الفروقَ غير اللفظية، كالتشكيل والتطويل.',
      'status.partial_match.label': 'مطابقة جزئية',
      'status.partial_match.meaning': 'جزء فقط من النص المُدخل يوافق المصدر؛ فالنص بصيغته المُدخلة غير مؤيَّد كاملًا.',
      'status.mismatch_at_cited_reference.label': 'لا يطابق الموضع المذكور',
      'status.mismatch_at_cited_reference.meaning': 'الموضع المذكور لا يتضمن النص المُدخل.',
      'status.quote_found_wrong_reference.label': 'النص في موضع آخر',
      'status.quote_found_wrong_reference.meaning': 'عُثر على النص في المصدر، لكن في غير الموضع المذكور.',
      'status.reference_found_without_quote.label': 'موضع بلا نص للمقارنة',
      'status.reference_found_without_quote.meaning': 'الموضع موجود في المصدر المفحوص، ولم يُرسَل نص مقتبس، فلم تُقارَن أي صياغة.',
      'status.not_found_in_checked_corpus.label': 'غير موجود في المصدر المفحوص',
      'status.not_found_in_checked_corpus.meaning': 'المصدر المحدود الذي بُحث فيه لا يتضمن هذا النص. ولا يدل ذلك على شيء بشأن المصادر الأخرى، ولا على كون الرواية صحيحة أو موضوعة.',
      'status.ambiguous_multiple_matches.label': 'مطابقات متعددة',
      'status.ambiguous_multiple_matches.meaning': 'طابق النصُّ أكثر من موضع في المصدر، فلا يمكن حصر النتيجة في موضع واحد.',
      'status.unsupported_source_or_language.label': 'المصدر أو اللغة غير مدعومة',
      'status.unsupported_source_or_language.meaning': 'لا يتوفر مُحقِّق مُعدّ لهذا المصدر وهذه اللغة.',
      'status.unknown.label': 'حالة غير معروفة',
      'status.unknown.meaning': 'لا تتعرّف هذه النسخة على الحالة المُعادة. تعامل مع القيمة الخام بحذر وراجع إصدار الواجهة البرمجية.',

      'error.cancelled': 'أُلغي',
      'error.cancelledMsg': 'أُلغي الطلب قبل وصول النتيجة.',
      'error.timeout': 'انتهت مهلة الواجهة البرمجية',
      'error.timeoutMsg': 'لم يصل رد من {base} في الوقت المحدد. إعادة المحاولة آمنة؛ ولم يُحكم بشيء على هذا الاستشهاد.',
      'error.noApi': 'لم تُضبط واجهة برمجية',
      'error.noApiMsg': 'فُتحت هذه الواجهة من القرص، فلا يوجد أصل لاستدعاء الواجهة البرمجية. افتح إعدادات الاتصال وأدخل العنوان الأساسي.',
      'error.unreachable': 'تعذّر الوصول إلى الواجهة البرمجية',
      'error.unreachableMsg': 'تعذّر الوصول إلى {base}. تأكد أن الخدمة تعمل، وأن العنوان صحيح، وأن أصل هذه الصفحة مُدرج في ISNAD_CORS_ORIGINS.',
      'error.sourceUnavailable': 'المصدر غير متاح',
      'error.sourceUnavailableMsg': 'تعذّر الوصول إلى المصدر، فلم يُفحص شيء.',
      'error.retryAfter': ' طلبت الواجهة إعادة المحاولة بعد {n} ثانية.',
      'error.sourceUnavailableDetail': 'هذا تعذّر في المصدر، وليس نتيجة «غير موجود». لم يُتحقق من النص.',
      'error.rejected': 'رُفض الطلب',
      'error.rejectedMsg': 'رفضت الواجهة البرمجية هذا الطلب لأنه غير صالح.',
      'error.fields': 'الحقول: {fields}',
      'error.rateLimited': 'تجاوز حد الطلبات',
      'error.rateLimitedMsg': 'الواجهة البرمجية تحدّ من الطلبات.',
      'error.retryAfterShort': ' أعد المحاولة بعد {n} ثانية.',
      'error.invalidResponse': 'رد غير مقروء',
      'error.invalidResponseMsg': 'ردّت الواجهة البرمجية بمحتوى ليس JSON صالحًا، فتعذّرت قراءة النتيجة.',
      'error.verifyFailed': 'فشل التحقق',
      'error.verifyFailedMsg': 'لم يكتمل طلب التحقق.',
      'error.code': 'الرمز: {code}',
      'error.requestCancelled': 'أُلغي الطلب.',
      'error.timeoutRaw': 'لم يكتمل الطلب إلى {base} في الوقت المحدد.',
      'error.networkRaw': 'تعذّر الوصول إلى الواجهة البرمجية على {base}.',
      'error.notJson': 'أعادت الواجهة البرمجية محتوى ليس JSON.',
      'error.nothingDecided': 'لم يُحكم بشيء على هذا الاستشهاد. وتعذّر الفحص لا يعني أن النص غير موجود.',
      'error.busy': 'هناك طلب قيد التنفيذ',

      'modelError.stopped': 'أُوقف',
      'modelError.stoppedMsg': 'أُوقف التوليد.',
      'modelError.unreachable': 'تعذّر الوصول إلى النموذج',
      'modelError.unreachableMsg': 'تعذّر الوصول إلى {base}. راجع العنوان الأساسي والشبكة، وهل يسمح المزوّد بطلبات المتصفح من هذا الأصل (المزوّد الذي يحجب CORS يحتاج وسيطًا محليًا مثل LiteLLM، كما في integrations.md).',
      'modelError.theEndpoint': 'نقطة النموذج',
      'modelError.badKey': 'رفض النموذج المفتاح',
      'modelError.badKeyMsg': 'رفضت النقطة مفتاح الواجهة (HTTP {status}). أعد إدخاله في إعدادات النموذج.',
      'modelError.rateLimited': 'تجاوز حد طلبات النموذج',
      'modelError.rateLimitedMsg': 'المزوّد يحدّ من طلبات هذا المفتاح. انتظر ثم أعد المحاولة.',
      'modelError.noStream': 'لا بث',
      'modelError.noStreamMsg': 'أجابت النقطة دون محتوى مُتدفّق، فتعذّر فحص أي استشهاد.',
      'modelError.provider': 'خطأ من المزوّد',
      'modelError.providerMsg': 'أبلغ المزوّد عن خطأ.',
      'modelError.failed': 'فشل طلب النموذج',
      'modelError.failedMsg': 'لم يكتمل طلب النموذج.',
      'modelError.cancelledRaw': 'أُلغي التوليد.',
      'modelError.networkRaw': 'تعذّر الوصول إلى نقطة النموذج على {base}.',
      'modelError.refusedRaw': 'رفضت نقطة النموذج الطلب (HTTP {status}).',

      'result.quotedText': 'النص المقتبس',
      'result.noQuote': 'لم يُرسَل نص',
      'result.citedRef': 'الموضع المذكور',
      'result.noRef': 'لم يُرسَل موضع',
      'result.matchedRefs': 'المواضع المطابقة',
      'result.noneForStatus': 'لا شيء لهذه الحالة',
      'result.source': 'المصدر',
      'result.coverage': 'نطاق التغطية',
      'result.notReported': 'لم تُبلغ عنه الواجهة البرمجية',
      'result.unnamedSource': 'مصدر غير مسمّى',
      'result.partialCoverage': 'تغطية بحث جزئية',
      'result.candidates': {
        zero: 'لم يُفحص أي مرشّح',
        one: 'فُحص مرشّح واحد',
        two: 'فُحص مرشّحان',
        few: 'فُحصت {n} مرشّحات',
        many: 'فُحص {n} مرشّحًا',
        other: 'فُحص {n} مرشّح'
      },
      'result.noEvidence': 'لم تُرفق أي سجلات شاهدة بهذه النتيجة.',
      'result.differences': 'فروق الصياغة الدقيقة التي أبلغ عنها المُحقِّق:',
      'result.checking': 'جارٍ الفحص',
      'result.waitingApi': 'بانتظار الواجهة البرمجية على {base}…',
      'result.referenceOnly': '(موضع فقط)',
      'result.reference': 'الموضع {ref}',
      'result.noReference': 'دون موضع',

      'evidence.unknownRef': 'موضع غير معروف',
      'evidence.fragment': 'المقطع المطابق: ',
      'evidence.recordTitle': 'عنوان السجل',
      'evidence.attribution': 'العزو',
      'evidence.bibliographic': 'المرجع',
      'evidence.grade': 'الدرجة',
      'evidence.gradeSource': 'مصدر الدرجة',
      'evidence.gradedBy': 'حكم عليه',
      'evidence.footnotes': 'الحواشي',
      'evidence.sourceRecord': 'سجل المصدر',
      'evidence.openRecord': 'فتح سجل المصدر',
      'evidence.noGrade': 'لم تُرفق درجة ولا اسم من حكم بها مع سجل المصدر هذا، ولا تستنتجها هذه الواجهة أبدًا.',
      'diff.submitted': 'المُدخل: ',
      'diff.source': 'المصدر: ',
      'diff.difference': 'فرق',
      'diff.kind.missing_from_submission': 'ناقص من النص المُدخل',
      'diff.kind.extra_in_submission': 'زائد في النص المُدخل',
      'diff.kind.wording_changed': 'صياغة مختلفة',

      'citation.kind': 'استشهاد',
      'citation.noRef': 'لم يُذكر موضع',
      'citation.checking': 'جارٍ فحص المصدر…',
      'citation.holding': 'يُحتجز النص المقتبس حتى يُفحص',
      'citation.notChecked': 'لم يُفحص',
      'citation.incomplete': 'استشهاد غير مكتمل',
      'citation.incompleteMsg': 'فتح النموذج اقتباسًا وتوقف قبل إغلاقه. النص المحتجز ({n} حرفًا) لم يُعرض ولم يُفحص.',
      'citation.rejected': 'علامة استشهاد مرفوضة',
      'citation.malformed': 'كتب النموذج علامة استشهاد تعذّر تحليل رأسها (حقل مطلوب ناقص أو مكرر).',
      'citation.oversized': 'كتب النموذج علامة استشهاد بلا نهاية.',
      'citation.unterminated': 'فتح النموذج علامة استشهاد ولم يُكملها.',
      'citation.rejectedGeneric': 'رُفضت علامة استشهاد.',
      'citation.withheld': ' حُجب النص المميّز ولم يُفحص.',
      'citation.reason': 'السبب: {reason}',
      'citation.notCheckedPlain': 'استشهاد لم يُفحص: {title}.',

      'msg.you': 'أنت',
      'msg.isnad': 'إسناد',
      'msg.waiting': 'بانتظار النموذج',
      'msg.retry': 'إعادة المحاولة',
      'msg.copyReply': 'نسخ الرد',
      'msg.copyMd': 'نسخ بصيغة Markdown',
      'msg.speak': 'قراءة بصوت مسموع',
      'msg.link': 'نسخ رابط هذا الرد',
      'msg.linkShort': 'نسخ الرابط',
      'msg.regenerate': 'إعادة توليد الرد',
      'msg.regenerateShort': 'إعادة التوليد',
      'msg.good': 'رد جيد',
      'msg.poor': 'رد ضعيف',
      'msg.prompt': 'عرض بروتوكول الاستشهاد',
      'msg.promptShort': 'بروتوكول الاستشهاد',
      'msg.edit': 'تعديل وإعادة الإرسال',
      'msg.copyMessage': 'نسخ الرسالة',
      'msg.remove': 'حذف الرسالة',
      'msg.removeShort': 'حذف',
      'msg.statsChecked': {
        zero: 'لا استشهادات',
        one: 'فُحص استشهاد واحد',
        two: 'فُحص استشهادان',
        few: 'فُحصت {n} استشهادات',
        many: 'فُحص {n} استشهادًا',
        other: 'فُحص {n} استشهاد'
      },
      'msg.statsFailed': '{n} لم يُفحص',
      'msg.statsStopped': 'أُوقف',
      'msg.statusLine': 'الحالة',
      'msg.gradeAsSupplied': 'الدرجة كما وردت في المصدر',

      'copy.copied': 'نُسخ',
      'copy.failed': 'تعذّر النسخ',
      'copy.unavailable': 'الحافظة غير متاحة',
      'copy.markdown': 'نُسخ بصيغة Markdown',
      'copy.link': 'نُسخ الرابط',
      'code.copy': 'نسخ',
      'code.sample': 'عيّنة {lang}، قابلة للتمرير',

      'export.nothing': 'لا شيء للتصدير بعد',
      'export.done': 'صُدّرت المحادثة',
      'export.you': 'أنت',
      'export.model': 'النموذج',
      'export.citation': 'استشهاد',
      'export.status': 'الحالة',
      'export.source': 'المصدر',
      'export.attribution': 'العزو',
      'export.grade': 'الدرجة',
      'export.gradeNone': 'لم يذكرها المصدر',
      'export.notChecked': 'لم يُفحص',
      'export.handCheck': 'تحقّق يدوي',

      'settings.title': 'الإعدادات',
      'settings.intro': 'النموذج الذي تحاوره، والواجهة البرمجية التي تفحص النصوص، ومظهر هذه الصفحة.',
      'settings.close': 'إغلاق الإعدادات',
      'settings.tabs': 'أقسام الإعدادات',
      'settings.tabModel': 'النموذج',
      'settings.tabApi': 'واجهة التحقق',
      'settings.tabAppearance': 'المظهر واللغة',
      'settings.provider': 'المزوّد',
      'settings.providerServer': 'Novita GLM 5.3 (المفتاح لدى هذا الخادم)',
      'settings.providerOllama': 'Ollama (محلي)',
      'settings.providerLitellm': 'وسيط LiteLLM (محلي)',
      'settings.providerCustom': 'نقطة أخرى متوافقة مع OpenAI',
      'settings.modelBase': 'العنوان الأساسي للنموذج',
      'settings.modelName': 'اسم النموذج',
      'settings.apiKey': 'مفتاح الواجهة',
      'settings.show': 'إظهار',
      'settings.hide': 'إخفاء',
      'settings.rememberKey': 'تذكّر المفتاح على هذا الجهاز',
      'settings.keyWarning': 'معطّل افتراضيًا: يبقى المفتاح في ذاكرة هذا التبويب فقط، وتُنسيه إعادة التحميل. وتفعيله يكتب المفتاح في التخزين المحلي للمتصفح بصيغة مقروءة — فيستطيع قراءته كل من يصل إلى هذا الجهاز أو أي نص برمجي يعمل في هذه الصفحة. ولا يُرسل المفتاح إلا إلى نقطة النموذج أعلاه.',
      'settings.temperature': 'درجة الحرارة',
      'settings.promptNotLoaded': 'لم يُحمَّل بروتوكول الاستشهاد بعد.',
      'settings.promptLoaded': 'حُمّل بروتوكول الاستشهاد {version} ويُضاف بوصفه رسالة النظام.',
      'settings.promptDisabled': 'لم يُحمَّل بروتوكول الاستشهاد، فالمحادثة معطّلة. حدّث الاتصال.',
      'settings.proxyHelp': 'المزوّدون الذين يحجبون طلبات المتصفح يحتاجون وسيطًا محليًا صغيرًا، وإعداد LiteLLM في {doc} أحدها. ويقدّم واجهة التحقق بروتوكولَ الاستشهاد على {path}، فلا يختلف النموذج والمُحقِّق أبدًا في العلامات.',
      'settings.forgetKey': 'نسيان المفتاح المحفوظ',
      'settings.cancel': 'إلغاء',
      'settings.save': 'حفظ',
      'settings.closeBtn': 'إغلاق',
      'settings.apiBase': 'العنوان الأساسي للواجهة البرمجية',
      'settings.apiBasePlaceholder': 'اتركه فارغًا لاستخدام أصل هذا الموقع',
      'settings.apiHelp': 'تستدعي الواجهة {paths}. ويجب أن يسمح الأصل المختلف بأصل هذه الواجهة في {env}. لا تضع مفاتيح أو كلمات مرور أو أسرارًا أخرى في هذا الحقل.',
      'settings.readinessHelp': 'تؤكد الجاهزية تحميل الواجهة البرمجية والبيانات المحلية المثبّتة، ولا تضمن أن خدمة HadeethEnc البعيدة متاحة.',
      'settings.clearHistory': 'مسح السجل المحلي',
      'settings.confirmClear': 'حذف كل المحادثات المحفوظة من هذا المتصفح؟ لا يمكن التراجع عن ذلك.',
      'settings.cleared': 'مُسح السجل المحلي',
      'settings.keyForgotten': 'نُسي المفتاح المحفوظ',
      'settings.language': 'اللغة',
      'settings.theme': 'المظهر',
      'settings.dark': 'داكن',
      'settings.light': 'فاتح',
      'settings.numerals': 'الأرقام',
      'settings.numeralsArab': 'هندية ١٢٣',
      'settings.numeralsLatn': 'عربية 123',
      'settings.calendar': 'التقويم',
      'settings.calendarGregory': 'ميلادي',
      'settings.calendarHijri': 'هجري',
      'settings.timestamps': 'إظهار الأوقات',
      'settings.needModelName': 'أدخل اسم النموذج الذي تتوقعه النقطة، مثل gpt-4o-mini.',
      'settings.modelSet': 'ضُبط النموذج على {model}',
      'settings.modelDisconnected': 'فُصل النموذج',
      'settings.errModel': 'نقطة النموذج: ',
      'settings.errApi': 'واجهة التحقق: ',
      'settings.errNotUrl': 'أدخل عنوانًا كاملًا مثل https://example.org، أو اترك الحقل فارغًا.',
      'settings.errScheme': 'لا يُقبل إلا عناوين http و https.',
      'settings.errCredentials': 'احذف بيانات الدخول من العنوان. المفاتيح مكانها حقل المفتاح، لا العنوان.',
      'settings.errNotBase': 'أدخل العنوان الأساسي فقط، دون استعلام أو جزء.',
      'settings.errUnusable': 'هذا العنوان غير صالح للاستخدام.',
      'settings.refreshed': 'حُدّثت حالة الاتصال',

      'prompt.title': 'بروتوكول الاستشهاد',
      'prompt.intro': 'يُضاف رسالةَ نظامٍ في كل محادثة، ليميّز النموذج النصوص المقتبسة بصيغة تستطيع هذه الصفحة فحصها. الإصدار {version}.',
      'prompt.notLoaded': 'لم يُحمَّل',
      'prompt.notLoadedBody': 'لم يُحمَّل بروتوكول الاستشهاد من الواجهة البرمجية.',
      'prompt.close': 'إغلاق',

      'source.quran': 'القرآن',
      'source.hadith': 'الحديث',
      'lang.ar': 'العربية',
      'lang.en': 'الإنجليزية',

      'duration.ms': '{n} م.ث',
      'duration.s': '{n} ث',

      'noscript': 'تتطلب هذه الواجهة تفعيل JavaScript. فعّله ثم أعد التحميل.',

      'dash.title': 'لوحة المتابعة',
      'dash.subtitle': 'ما فُحص من استشهادات، وكيف طابقت مصادرها',
      'dash.scope': 'نطاق البيانات',
      'dash.scopeDevice': 'هذا الجهاز',
      'dash.scopeServer': 'الخادم',
      'dash.range': 'المدة',
      'dash.range7': 'آخر ٧ أيام',
      'dash.range30': 'آخر ٣٠ يومًا',
      'dash.range90': 'آخر ٩٠ يومًا',
      'dash.rangeAll': 'كل السجل',
      'dash.exportCsv': 'تصدير CSV',
      'dash.kpiChecked': 'استشهادات مفحوصة',
      'dash.kpiMatchRate': 'نسبة المطابقة',
      'dash.kpiMatchRateHint': 'تامة وبعد توحيد الرسم وجزئية',
      'dash.kpiReview': 'تحتاج مراجعة',
      'dash.kpiReviewHint': 'لا تطابق، أو في موضع آخر، أو غير موجودة، أو متعددة',
      'dash.kpiLatency': 'متوسط زمن الفحص',
      'dash.kpiNotChecked': 'تعذّر فحصها: {n}',
      'dash.statusTitle': 'توزيع حالات المطابقة',
      'dash.activityTitle': 'النشاط اليومي',
      'dash.activityMatched': 'مطابقة',
      'dash.activityReview': 'تحتاج مراجعة',
      'dash.activityOther': 'أخرى',
      'dash.sourcesTitle': 'حسب المصدر واللغة',
      'dash.healthTitle': 'صحة المصادر والنظام',
      'dash.healthReady': 'جاهز',
      'dash.healthLoaded': 'محمّل',
      'dash.healthRemote': 'مصدر بعيد',
      'dash.healthUnknown': 'غير معروف',
      'dash.healthApi': 'الواجهة البرمجية',
      'dash.healthProtocol': 'بروتوكول الاستشهاد',
      'dash.healthModel': 'النموذج',
      'dash.healthChecksum': 'بصمة SHA-256',
      'dash.healthOffline': 'الواجهة البرمجية غير متاحة، فحالة المصادر غير معروفة.',
      'dash.flaggedTitle': 'استشهادات تحتاج مراجعة',
      'dash.flaggedEmpty': 'لا استشهادات تحتاج مراجعة في هذه المدة.',
      'dash.flaggedServer': 'لا يحفظ الخادم نصوص الاستشهادات ولا مواضعها، فهذا الجدول متاح لنطاق «هذا الجهاز» فقط.',
      'dash.colText': 'النص',
      'dash.colRef': 'الموضع المذكور',
      'dash.colStatus': 'الحالة',
      'dash.colSource': 'المصدر',
      'dash.colWhen': 'الوقت',
      'dash.open': 'فتح المحادثة',
      'dash.filterAll': 'كل الحالات',
      'dash.emptyTitle': 'لم تُفحص أي استشهادات بعد',
      'dash.emptySub': 'ابدأ محادثة أو تحقّق من نص بنفسك، وستظهر هنا النتائج من هذا الجهاز.',
      'dash.startChat': 'بدء محادثة',
      'dash.startVerify': 'تحقّق من نص',
      'dash.serverDisabled': 'إحصاءات الخادم غير مفعّلة في هذا النشر. فعّلها بالمتغير ISNAD_STATS_ENABLED=1.',
      'dash.serverLoading': 'جارٍ تحميل إحصاءات الخادم…',
      'dash.serverError': 'تعذّر تحميل إحصاءات الخادم.',
      'dash.serverVolatile': 'تُحفظ إحصاءات الخادم في الذاكرة وتُصفَّر عند إعادة تشغيله.',
      'dash.serverSince': 'منذ {date}',
      'dash.disclaimer': 'نسب المطابقة تصف التطابق النصي مع الإصدار المفحوص فقط، وليست حكمًا على صحة الأحاديث.',
      'dash.chartTable': 'بيانات المخطط',
      'dash.day': 'اليوم',
      'dash.count': 'العدد',
      'dash.csvDone': 'صُدّر ملف CSV',
      'dash.noData': 'لا بيانات'
    },

    en: {
      'app.name': 'Isnad',
      'app.title': 'Isnad — source-checked chat',
      'app.tagline': 'Qur’an and hadith citation checking',

      'nav.label': 'Main navigation',
      'nav.chat': 'Conversations',
      'nav.dashboard': 'Dashboard',
      'nav.newChat': 'New chat',
      'nav.collapse': 'Collapse sidebar',
      'nav.show': 'Show conversations',
      'nav.conversations': 'Saved conversations',
      'nav.search': 'Search conversations…',
      'nav.searchLabel': 'Search conversations',
      'nav.clearSearch': 'Clear search',
      'nav.settings': 'Settings',
      'nav.settingsSub': 'Model · API · appearance',
      'nav.openDashboard': 'Open the dashboard',
      'nav.openChat': 'Back to the conversation',

      'group.today': 'Today',
      'group.yesterday': 'Yesterday',
      'group.week': 'Previous 7 days',
      'group.year': 'Earlier this year',
      'group.older': 'Older',
      'list.empty': 'No conversations yet',
      'list.noMatch': 'No matching conversations',
      'list.matches': {
        one: '{n} of {total} conversations matches',
        other: '{n} of {total} conversations match'
      },
      'list.delete': 'Delete “{title}”',
      'list.deleteShort': 'Delete',
      'list.confirmDelete': 'Delete “{title}” and its messages? This cannot be undone.',
      'list.deleted': 'Conversation deleted',

      'chat.untitled': 'New chat',
      'chat.checkTitle': 'Check · {ref}',
      'chat.badge': 'Source check',
      'chat.badgeTitle': 'Quotations are checked against pinned sources',

      'header.refresh': 'Refresh connection status',
      'header.refreshTitle': 'Refresh connection',
      'header.export': 'Export conversation',
      'header.themeToDark': 'Switch to dark theme',
      'header.themeToLight': 'Switch to light theme',
      'header.themeTitle': 'Switch theme',
      'header.language': 'عربي',
      'header.languageLabel': 'التبديل إلى العربية',
      'header.modelTitle': 'Model settings',

      'api.checking': 'API checking',
      'api.ready': 'API ready',
      'api.unavailable': 'API unreachable',
      'api.thisOrigin': 'this page’s origin',
      'api.connectedTo': 'Connected to {base}',
      'api.noneConfigured': 'No API configured — open Connection settings',
      'api.version': 'API version {version}',
      'api.unreported': 'unreported',
      'api.pairs': '{n} source/language pairs',
      'api.editions': '{n} loaded editions',
      'api.promptMissing': 'Citation protocol prompt unavailable — chat is disabled',
      'api.enterBase': 'Enter the API base URL in Connection settings',
      'api.unreachableHint': 'Unreachable — check the base URL and CORS allow-list',
      'api.readinessSilent': 'Readiness probe did not answer',

      'model.none': 'No model',
      'model.noneSelected': 'no model selected',
      'model.endpoint': 'Model endpoint {base}',
      'model.keyDevice': 'key held on this device',
      'model.keyMemory': 'key held in memory only',
      'model.noKey': 'no key set',
      'model.openSettings': 'Open Model settings to connect a model',

      'mode.label': 'Mode',
      'mode.chat': 'Chat',
      'mode.verify': 'Verify a quote',

      'verify.source': 'Source',
      'verify.language': 'Language',
      'verify.reference': 'Reference',
      'verify.optional': 'optional',
      'verify.quran': 'Qur’an',
      'verify.hadith': 'Hadith',
      'verify.arabic': 'Arabic',
      'verify.english': 'English',
      'verify.referencePlaceholder': 'reference',

      'composer.label': 'Message or quoted text',
      'composer.placeholderChat': 'Ask anything… quotations will be checked before you see them',
      'composer.placeholderVerify': 'Paste the quoted source text…',
      'composer.hint': 'Enter to send · Shift+Enter for a new line',
      'composer.hintDefault': 'You may provide a quote, a source reference, or both.',
      'composer.hintChat': 'The model is asked to mark quotations with references; you can answer questions without one.',
      'composer.hintNoAdapter': 'No adapter is configured for the selected source and language.',
      'composer.hintFormat': 'Reference format here: {format}',
      'composer.hintOptional': 'Optional. With the locator you were given, the check is compared at that reference; without one, the wording is searched for in the whole source.',
      'composer.send': 'Send',
      'composer.verify': 'Verify',
      'composer.stop': 'Stop',
      'composer.stopGenerating': 'Stop generating',
      'composer.verifyTitle': 'Verify against the pinned source',
      'composer.configureFirst': 'Configure a model first',
      'composer.note': 'Quotations are checked against the pinned sources. A match status is textual correspondence only — not a hadith authenticity grade or religious ruling. Grades and graders are shown only where a source states them; this interface never infers one. A failed check is not a not-found result.',

      'validate.empty': 'Provide quoted text, a source reference, or both.',
      'validate.tooLong': 'The quote is {length} characters; the API limit is {limit}.',
      'validate.refTooLong': 'A reference may be at most 64 characters.',
      'validate.unsupported': 'No adapter is configured for {pair} in this deployment.',

      'empty.chatTitle': 'Ask anything',
      'empty.connectTitle': 'Connect a model to chat',
      'empty.chatSub': 'Answers stream normally. Any verse or hadith the model quotes is held, checked against the pinned source, and shown as a verified card.',
      'empty.connectSub': 'Add a model endpoint and key in Model settings, and this interface will inject the citation protocol automatically.',
      'empty.fromDisk': 'This file was opened from disk. Open Connection settings and enter the verification API base URL — citations cannot be checked without it.',
      'empty.apiDown': 'The verification API is unreachable, so quotations cannot be checked yet. Chat still needs it; only prose would be trustworthy without it.',
      'empty.suggestVerse': 'Verse',
      'empty.suggestVerseText': 'Quote Sūrat al-Ikhlāṣ with its reference.',
      'empty.suggestHadith': 'Hadith',
      'empty.suggestHadithText': 'Quote a hadith about intention, with the reference you have.',
      'empty.suggestAsk': 'Ask',
      'empty.suggestAskText': 'What does the Qur’an say about patience?',
      'empty.verifyTitle': 'Check a quotation by hand',
      'empty.verifySub': 'Paste a quoted verse or hadith and the reference you were given. The answer comes from the pinned source data, with the source wording shown verbatim.',
      'empty.readingCaps': 'Reading {path}…',
      'empty.capsFromDisk': 'This file was opened from disk, so no API is configured yet. Open Connection settings and enter the API base URL.',
      'empty.capsDown': 'The API could not be reached, so supported sources and limits are unknown. Set the base URL in Connection settings and refresh.',
      'empty.apiVersion': 'API version',
      'empty.statuses': 'Statuses',
      'empty.statusesValue': '{n} textual-correspondence outcomes',
      'empty.quoteLimit': 'Quote limit',
      'empty.quoteLimitValue': '{n} characters',
      'empty.streaming': 'Streaming',
      'empty.streamingValue': 'WebSocket {path} · {n} KiB messages',
      'empty.statusGuide': 'What each status means',
      'empty.statusGuideNote': 'None of these is a hadith grade, an authenticity ruling, or a religious judgement.',
      'empty.supported': 'Supported in this deployment',
      'empty.readiness': 'Readiness reports {n} loaded source edition(s). A remote source being ready does not mean it is reachable right now.',

      'status.exact_match.label': 'Exact match',
      'status.exact_match.meaning': 'The submitted text matches the source wording at the cited reference.',
      'status.normalized_match.label': 'Match after normalization',
      'status.normalized_match.meaning': 'The text matches the source once non-lexical differences such as diacritics and tatweel are set aside by the source’s normalization profile.',
      'status.partial_match.label': 'Partial match',
      'status.partial_match.meaning': 'Only part of the submitted text corresponds to the source. The quote is not fully supported as submitted.',
      'status.mismatch_at_cited_reference.label': 'Mismatch at the cited reference',
      'status.mismatch_at_cited_reference.meaning': 'The cited reference does not contain the submitted wording.',
      'status.quote_found_wrong_reference.label': 'Quote found at a different reference',
      'status.quote_found_wrong_reference.meaning': 'The wording was located in the source, but not at the reference that was cited.',
      'status.reference_found_without_quote.label': 'Reference found, no quote compared',
      'status.reference_found_without_quote.meaning': 'The reference exists in the checked source. No quoted text was submitted, so no wording was compared.',
      'status.not_found_in_checked_corpus.label': 'Not found in the checked corpus',
      'status.not_found_in_checked_corpus.meaning': 'The bounded source that was searched does not contain this wording. This says nothing about sources outside that corpus, and nothing about whether the report is authentic or fabricated.',
      'status.ambiguous_multiple_matches.label': 'Ambiguous — multiple matches',
      'status.ambiguous_multiple_matches.meaning': 'More than one location in the source matched. The result cannot be reduced to a single reference.',
      'status.unsupported_source_or_language.label': 'Source or language not supported',
      'status.unsupported_source_or_language.meaning': 'No adapter is configured for this source and language pair.',
      'status.unknown.label': 'Unknown status',
      'status.unknown.meaning': 'This build does not recognize the returned status. Treat the raw value with caution and check the API version.',

      'error.cancelled': 'Cancelled',
      'error.cancelledMsg': 'Cancelled before a result was returned.',
      'error.timeout': 'The API timed out',
      'error.timeoutMsg': 'No response arrived from {base} in time. Retrying is safe; nothing was decided about the citation.',
      'error.noApi': 'No API configured',
      'error.noApiMsg': 'This interface was opened from disk, so there is no API origin to call. Open Connection settings and enter the API base URL.',
      'error.unreachable': 'API unreachable',
      'error.unreachableMsg': 'Could not reach {base}. Check that the service is running, that the base URL is correct, and that this page’s origin is listed in ISNAD_CORS_ORIGINS.',
      'error.sourceUnavailable': 'Source unavailable',
      'error.sourceUnavailableMsg': 'The upstream source could not be reached, so nothing was checked.',
      'error.retryAfter': ' The API asked to retry after {n} seconds.',
      'error.sourceUnavailableDetail': 'This is a source failure, not a not-found result. The quote was not verified.',
      'error.rejected': 'Request rejected',
      'error.rejectedMsg': 'The API rejected this request as invalid.',
      'error.fields': 'Fields: {fields}',
      'error.rateLimited': 'Rate limited',
      'error.rateLimitedMsg': 'The API is limiting requests.',
      'error.retryAfterShort': ' Retry after {n} seconds.',
      'error.invalidResponse': 'Unreadable response',
      'error.invalidResponseMsg': 'The API replied with a body that is not valid JSON, so no result could be read.',
      'error.verifyFailed': 'Verification failed',
      'error.verifyFailedMsg': 'The verification request did not complete.',
      'error.code': 'code: {code}',
      'error.requestCancelled': 'Request cancelled.',
      'error.timeoutRaw': 'The request to {base} did not finish in time.',
      'error.networkRaw': 'Could not reach the API at {base}.',
      'error.notJson': 'The API returned a body that is not JSON.',
      'error.nothingDecided': 'Nothing about this citation was decided. A failed check is not a not-found result.',
      'error.busy': 'A request is already running',

      'modelError.stopped': 'Stopped',
      'modelError.stoppedMsg': 'Generation was stopped.',
      'modelError.unreachable': 'Model unreachable',
      'modelError.unreachableMsg': 'Could not reach {base}. Check the base URL, the network, and whether the provider allows browser requests from this origin (a provider that blocks CORS will need a local proxy such as LiteLLM, documented in integrations.md).',
      'modelError.theEndpoint': 'the model endpoint',
      'modelError.badKey': 'Model rejected the key',
      'modelError.badKeyMsg': 'The endpoint refused the API key (HTTP {status}). Re-enter it in Model settings.',
      'modelError.rateLimited': 'Model rate limited',
      'modelError.rateLimitedMsg': 'The provider is rate limiting this key. Wait, then try again.',
      'modelError.noStream': 'No stream',
      'modelError.noStreamMsg': 'The endpoint answered without a streamed body, so no citation could be checked.',
      'modelError.provider': 'Provider error',
      'modelError.providerMsg': 'The provider reported an error.',
      'modelError.failed': 'Model request failed',
      'modelError.failedMsg': 'The model request did not complete.',
      'modelError.cancelledRaw': 'Generation cancelled.',
      'modelError.networkRaw': 'Could not reach the model endpoint at {base}.',
      'modelError.refusedRaw': 'The model endpoint refused the request (HTTP {status}).',

      'result.quotedText': 'Quoted text',
      'result.noQuote': 'No quote submitted',
      'result.citedRef': 'Cited reference',
      'result.noRef': 'No reference submitted',
      'result.matchedRefs': 'Matched references',
      'result.noneForStatus': 'None reported for this status',
      'result.source': 'Source',
      'result.coverage': 'Coverage',
      'result.notReported': 'Not reported by the API',
      'result.unnamedSource': 'Unnamed source',
      'result.partialCoverage': 'partial search coverage',
      'result.candidates': {
        one: '{n} candidate checked',
        other: '{n} candidates checked'
      },
      'result.noEvidence': 'No evidence records were returned with this result.',
      'result.differences': 'Exact wording differences reported by the verifier:',
      'result.checking': 'Checking',
      'result.waitingApi': 'Waiting for the API at {base}…',
      'result.referenceOnly': '(reference only)',
      'result.reference': 'reference {ref}',
      'result.noReference': 'no reference',

      'evidence.unknownRef': 'unknown reference',
      'evidence.fragment': 'Matched fragment: ',
      'evidence.recordTitle': 'Record title',
      'evidence.attribution': 'Attribution',
      'evidence.bibliographic': 'Bibliographic reference',
      'evidence.grade': 'Grade',
      'evidence.gradeSource': 'Grade source',
      'evidence.gradedBy': 'Graded by',
      'evidence.footnotes': 'Footnotes',
      'evidence.sourceRecord': 'Source record',
      'evidence.openRecord': 'Open source record',
      'evidence.noGrade': 'No grade or grader was supplied with this source record. This interface never infers one.',
      'diff.submitted': 'Submitted: ',
      'diff.source': 'Source: ',
      'diff.difference': 'difference',
      'diff.kind.missing_from_submission': 'Missing from the submission',
      'diff.kind.extra_in_submission': 'Extra in the submission',
      'diff.kind.wording_changed': 'Wording changed',

      'citation.kind': 'Citation',
      'citation.noRef': 'reference not given',
      'citation.checking': 'checking source…',
      'citation.holding': 'Holding the quotation until it has been checked',
      'citation.notChecked': 'not checked',
      'citation.incomplete': 'Incomplete citation',
      'citation.incompleteMsg': 'The model opened a quotation and stopped before closing it. The held text ({n} characters) was not shown or checked.',
      'citation.rejected': 'Rejected citation marker',
      'citation.malformed': 'The model wrote a citation marker whose header did not parse (a required field was missing or repeated).',
      'citation.oversized': 'The model wrote a citation marker with no end.',
      'citation.unterminated': 'The model opened a citation marker and never finished it.',
      'citation.rejectedGeneric': 'A citation marker was rejected.',
      'citation.withheld': ' The marked text was withheld and not checked.',
      'citation.reason': 'reason: {reason}',
      'citation.notCheckedPlain': 'Citation not checked: {title}.',

      'msg.you': 'You',
      'msg.isnad': 'Isnad',
      'msg.waiting': 'Waiting for the model',
      'msg.retry': 'Retry',
      'msg.copyReply': 'Copy reply',
      'msg.copyMd': 'Copy as Markdown',
      'msg.speak': 'Read aloud',
      'msg.link': 'Copy link to this reply',
      'msg.linkShort': 'Copy link',
      'msg.regenerate': 'Regenerate reply',
      'msg.regenerateShort': 'Regenerate',
      'msg.good': 'Good reply',
      'msg.poor': 'Poor reply',
      'msg.prompt': 'Inspect the citation protocol prompt',
      'msg.promptShort': 'Citation protocol prompt',
      'msg.edit': 'Edit and resend',
      'msg.copyMessage': 'Copy message',
      'msg.remove': 'Remove message',
      'msg.removeShort': 'Remove',
      'msg.statsChecked': {
        zero: 'no citations',
        one: '{n} citation checked',
        other: '{n} citations checked'
      },
      'msg.statsFailed': '{n} not checked',
      'msg.statsStopped': 'stopped',
      'msg.statusLine': 'Status',
      'msg.gradeAsSupplied': 'Grade as supplied by the source',

      'copy.copied': 'Copied',
      'copy.failed': 'Could not copy',
      'copy.unavailable': 'Clipboard unavailable',
      'copy.markdown': 'Markdown copied',
      'copy.link': 'Link copied',
      'code.copy': 'Copy',
      'code.sample': '{lang} sample, scrollable',

      'export.nothing': 'Nothing to export yet',
      'export.done': 'Conversation exported',
      'export.you': 'You',
      'export.model': 'model',
      'export.citation': 'Citation',
      'export.status': 'Status',
      'export.source': 'Source',
      'export.attribution': 'Attribution',
      'export.grade': 'Grade',
      'export.gradeNone': 'not supplied by the source',
      'export.notChecked': 'Not checked',
      'export.handCheck': 'Hand check',

      'settings.title': 'Settings',
      'settings.intro': 'The model you chat with, the API that checks quotations, and how this page looks.',
      'settings.close': 'Close settings',
      'settings.tabs': 'Settings sections',
      'settings.tabModel': 'Model',
      'settings.tabApi': 'Verification API',
      'settings.tabAppearance': 'Appearance & language',
      'settings.provider': 'Provider',
      'settings.providerServer': 'Novita GLM 5.3 (key held by this server)',
      'settings.providerOllama': 'Ollama (local)',
      'settings.providerLitellm': 'LiteLLM proxy (local)',
      'settings.providerCustom': 'Other OpenAI-compatible endpoint',
      'settings.modelBase': 'Model base URL',
      'settings.modelName': 'Model name',
      'settings.apiKey': 'API key',
      'settings.show': 'Show',
      'settings.hide': 'Hide',
      'settings.rememberKey': 'Remember the key on this device',
      'settings.keyWarning': 'Off by default: the key is then kept in this tab’s memory only, and a reload forgets it. Turning this on writes the key into this browser’s local storage in readable form — anyone with access to this device, or to a script running on this page, can read it. The key is sent only to the model endpoint above.',
      'settings.temperature': 'Temperature',
      'settings.promptNotLoaded': 'The citation protocol prompt has not loaded yet.',
      'settings.promptLoaded': 'Citation protocol {version} loaded and injected as the system message.',
      'settings.promptDisabled': 'The citation protocol prompt has not loaded, so chat is disabled. Refresh the connection.',
      'settings.proxyHelp': 'Providers that block browser requests need a small local proxy; the LiteLLM setup in {doc} is one. The protocol prompt is served by the verification API at {path}, so the model and the checker can never disagree about the markers.',
      'settings.forgetKey': 'Forget stored key',
      'settings.cancel': 'Cancel',
      'settings.save': 'Save',
      'settings.closeBtn': 'Close',
      'settings.apiBase': 'API base URL',
      'settings.apiBasePlaceholder': 'Leave blank to use this site’s origin',
      'settings.apiHelp': 'The UI calls {paths}. A different origin must allow this UI origin in {env}. Do not put keys, passwords, or other secrets in this field.',
      'settings.readinessHelp': 'Readiness confirms the API and pinned local data are loaded; it does not guarantee that the remote HadeethEnc service is reachable.',
      'settings.clearHistory': 'Clear local history',
      'settings.confirmClear': 'Delete every saved conversation from this browser? This cannot be undone.',
      'settings.cleared': 'Local history cleared',
      'settings.keyForgotten': 'Stored key forgotten',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'settings.dark': 'Dark',
      'settings.light': 'Light',
      'settings.numerals': 'Numerals',
      'settings.numeralsArab': 'Arabic-Indic ١٢٣',
      'settings.numeralsLatn': 'Western 123',
      'settings.calendar': 'Calendar',
      'settings.calendarGregory': 'Gregorian',
      'settings.calendarHijri': 'Hijri',
      'settings.timestamps': 'Show timestamps',
      'settings.needModelName': 'Enter the model name the endpoint expects, for example gpt-4o-mini.',
      'settings.modelSet': 'Model set to {model}',
      'settings.modelDisconnected': 'Model disconnected',
      'settings.errModel': 'Model endpoint: ',
      'settings.errApi': 'Verification API: ',
      'settings.errNotUrl': 'Enter a full URL such as https://example.org, or leave the field blank.',
      'settings.errScheme': 'Only http and https URLs are accepted.',
      'settings.errCredentials': 'Remove the credentials from the URL. Keys belong in the key field, never in a URL.',
      'settings.errNotBase': 'Give the base URL only, without a query string or fragment.',
      'settings.errUnusable': 'That URL is not usable.',
      'settings.refreshed': 'Connection status refreshed',

      'prompt.title': 'Citation protocol prompt',
      'prompt.intro': 'Injected as the system message of every conversation, so the model marks quotations in a form this page can check. Version {version}.',
      'prompt.notLoaded': 'not loaded',
      'prompt.notLoadedBody': 'The citation protocol prompt has not loaded from the API.',
      'prompt.close': 'Close',

      'source.quran': 'Qur’an',
      'source.hadith': 'Hadith',
      'lang.ar': 'Arabic',
      'lang.en': 'English',

      'duration.ms': '{n} ms',
      'duration.s': '{n} s',

      'noscript': 'This interface requires JavaScript. Please enable it and reload.',

      'dash.title': 'Dashboard',
      'dash.subtitle': 'What was checked, and how it matched its sources',
      'dash.scope': 'Data scope',
      'dash.scopeDevice': 'This device',
      'dash.scopeServer': 'Server',
      'dash.range': 'Period',
      'dash.range7': 'Last 7 days',
      'dash.range30': 'Last 30 days',
      'dash.range90': 'Last 90 days',
      'dash.rangeAll': 'All history',
      'dash.exportCsv': 'Export CSV',
      'dash.kpiChecked': 'Citations checked',
      'dash.kpiMatchRate': 'Match rate',
      'dash.kpiMatchRateHint': 'exact, normalized and partial',
      'dash.kpiReview': 'Needs review',
      'dash.kpiReviewHint': 'mismatch, wrong reference, not found, or ambiguous',
      'dash.kpiLatency': 'Average check time',
      'dash.kpiNotChecked': '{n} could not be checked',
      'dash.statusTitle': 'Match status distribution',
      'dash.activityTitle': 'Daily activity',
      'dash.activityMatched': 'Matched',
      'dash.activityReview': 'Needs review',
      'dash.activityOther': 'Other',
      'dash.sourcesTitle': 'By source and language',
      'dash.healthTitle': 'Source and system health',
      'dash.healthReady': 'Ready',
      'dash.healthLoaded': 'Loaded',
      'dash.healthRemote': 'Remote source',
      'dash.healthUnknown': 'Unknown',
      'dash.healthApi': 'Verification API',
      'dash.healthProtocol': 'Citation protocol',
      'dash.healthModel': 'Model',
      'dash.healthChecksum': 'SHA-256',
      'dash.healthOffline': 'The API is unreachable, so source health is unknown.',
      'dash.flaggedTitle': 'Citations that need review',
      'dash.flaggedEmpty': 'No citations need review in this period.',
      'dash.flaggedServer': 'The server keeps no quotation text or references, so this table is available for “This device” only.',
      'dash.colText': 'Text',
      'dash.colRef': 'Cited reference',
      'dash.colStatus': 'Status',
      'dash.colSource': 'Source',
      'dash.colWhen': 'When',
      'dash.open': 'Open conversation',
      'dash.filterAll': 'All statuses',
      'dash.emptyTitle': 'No citations checked yet',
      'dash.emptySub': 'Start a conversation or check a quotation by hand, and the results from this device will appear here.',
      'dash.startChat': 'Start a chat',
      'dash.startVerify': 'Verify a quote',
      'dash.serverDisabled': 'Server statistics are not enabled in this deployment. Enable them with ISNAD_STATS_ENABLED=1.',
      'dash.serverLoading': 'Loading server statistics…',
      'dash.serverError': 'Server statistics could not be loaded.',
      'dash.serverVolatile': 'Server statistics are held in memory and reset when the server restarts.',
      'dash.serverSince': 'since {date}',
      'dash.disclaimer': 'Match rates describe textual correspondence with the checked edition only, not the authenticity of any hadith.',
      'dash.chartTable': 'Chart data',
      'dash.day': 'Day',
      'dash.count': 'Count',
      'dash.csvDone': 'CSV exported',
      'dash.noData': 'No data'
    }
  };

  const LANG_KEY = 'isnad.gui.lang.v1';
  const state = { lang: 'ar', numerals: 'arab', calendar: 'gregory' };

  function readSavedLanguage() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(LANG_KEY) || 'null');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch (e) { /* storage blocked: fall through to the default */ }
    return 'ar';
  }

  function setLanguage(lang) {
    state.lang = lang === 'en' ? 'en' : 'ar';
    const root = document.documentElement;
    root.setAttribute('lang', state.lang);
    root.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
    try { window.localStorage.setItem(LANG_KEY, JSON.stringify(state.lang)); } catch (e) { /* ignore */ }
    return state.lang;
  }

  function setFormat(options) {
    if (options && (options.numerals === 'arab' || options.numerals === 'latn')) state.numerals = options.numerals;
    if (options && (options.calendar === 'gregory' || options.calendar === 'islamic-umalqura')) state.calendar = options.calendar;
  }

  /* Locale tag for Intl: Arabic picks the numeral system the reader chose;
     English always uses Western digits. The calendar applies to both. */
  function locale() {
    const base = state.lang === 'ar' ? 'ar-SA-u-nu-' + state.numerals : 'en-GB-u-nu-latn';
    return base + '-ca-' + state.calendar;
  }

  function number(n, options) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    try { return new Intl.NumberFormat(locale(), options).format(n); }
    catch (e) { return String(n); }
  }

  function percent(ratio) {
    return number(ratio, { style: 'percent', maximumFractionDigits: 0 });
  }

  function date(ts, options) {
    try { return new Intl.DateTimeFormat(locale(), options || { dateStyle: 'medium' }).format(new Date(ts)); }
    catch (e) { return ''; }
  }

  function time(ts) {
    return date(ts, { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function lookup(lang, key) {
    const table = CATALOG[lang];
    return table && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
  }

  /* t('key', { name: value }). A plural key needs params.n; {n} is formatted
     with the reader's numerals, other params are inserted as given. */
  function t(key, params) {
    let value = lookup(state.lang, key);
    if (value === undefined) value = lookup('en', key);
    if (value === undefined) return key;
    const p = params || {};
    if (typeof value === 'object') {
      const n = typeof p.n === 'number' ? p.n : 0;
      let rule = 'other';
      try { rule = new Intl.PluralRules(state.lang === 'ar' ? 'ar' : 'en').select(n); } catch (e) { /* other */ }
      if (n === 0 && value.zero !== undefined) rule = 'zero';
      value = value[rule] !== undefined ? value[rule] : value.other;
    }
    return String(value).replace(/\{(\w+)\}/g, function (match, name) {
      if (!Object.prototype.hasOwnProperty.call(p, name)) return match;
      const v = p[name];
      return typeof v === 'number' ? number(v) : String(v);
    });
  }

  /* Fills [data-i18n] text and [data-i18n-attr="attr:key;attr:key"]
     attributes. Static markup only: rendered views call t() themselves. */
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (node) {
      const text = t(node.getAttribute('data-i18n'));
      const codes = node.getAttribute('data-i18n-code');
      if (!codes) { node.textContent = text; return; }
      /* Help text that names paths or variables: each {param} becomes a
         <code> element holding the value from data-i18n-code. */
      let values = {};
      try { values = JSON.parse(codes); } catch (e) { /* show the text without them */ }
      node.innerHTML = escapeHtml(text).replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(values, name)
          ? '<code dir="ltr">' + escapeHtml(values[name]) + '</code>' : match;
      });
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      node.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        const bits = pair.split(':');
        if (bits.length === 2 && bits[0].trim()) node.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });
    document.title = t('app.title');
  }

  /* Search key for Arabic text: drops tashkeel, Qur'anic annotation marks and
     tatweel, and folds the letter variants a reader types interchangeably.
     For finding conversations only — verification uses the server's own
     normalization profiles and never this. */
  function searchKey(text) {
    return String(text == null ? '' : text)
      .normalize('NFKC')
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
      .replace(/[آأإٱٲٳ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ؤ]/g, 'و')
      .replace(/[ئ]/g, 'ي')
      .toLowerCase();
  }

  state.lang = readSavedLanguage();

  global.IsnadI18n = {
    t: t,
    apply: apply,
    setLanguage: setLanguage,
    setFormat: setFormat,
    language: function () { return state.lang; },
    isRtl: function () { return state.lang === 'ar'; },
    locale: locale,
    number: number,
    percent: percent,
    date: date,
    time: time,
    searchKey: searchKey,
    catalog: CATALOG
  };
})(window);
