// Starting text for the editable screens. Written once into the database on first start;
// after that, edit it from the in-app admin screen (Admin → App content) without a new release.

export const CONTENT_KEYS = ['about_intro', 'who_runs_this_app', 'partnerships', 'terms', 'privacy'] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

export const DEFAULT_CONTENT: { key: ContentKey; language: 'en' | 'vi'; title: string; body: string }[] = [
  {
    key: 'about_intro',
    language: 'en',
    title: 'About Tastr',
    body:
      "Tastr is for people who'd cross town for a perfect bowl of mì Quảng and still complain about the price of the beer.\n\n" +
      'Real people, real photos, honest reviews. No paid ratings, ever. If a business gave someone a freebie, the review says so.',
  },
  {
    key: 'about_intro',
    language: 'vi',
    title: 'Về Tastr',
    body:
      'Tastr dành cho những người sẵn sàng băng qua cả thành phố vì một tô mì Quảng ngon, rồi vẫn cằn nhằn giá bia.\n\n' +
      'Người thật, ảnh thật, đánh giá thật lòng. Không bao giờ có điểm mua bằng tiền. Nếu quán tặng đồ miễn phí, bài đánh giá sẽ ghi rõ.',
  },
  {
    key: 'who_runs_this_app',
    language: 'en',
    title: 'Who runs this app',
    body: '[PLACEHOLDER] Say here who operates Tastr: the company or person responsible, where it is registered and how to contact it.',
  },
  {
    key: 'who_runs_this_app',
    language: 'vi',
    title: 'Ai vận hành ứng dụng này',
    body: '[NỘI DUNG TẠM] Ghi rõ đơn vị hoặc cá nhân vận hành Tastr, nơi đăng ký và cách liên hệ.',
  },
  {
    key: 'partnerships',
    language: 'en',
    title: 'Partnerships and affiliations',
    body: '[PLACEHOLDER] List any partnerships, sponsors, affiliate deals or business relationships here. If there are none, say so.',
  },
  {
    key: 'partnerships',
    language: 'vi',
    title: 'Đối tác và liên kết',
    body: '[NỘI DUNG TẠM] Liệt kê mọi đối tác, nhà tài trợ, chương trình liên kết hoặc quan hệ kinh doanh. Nếu không có, hãy ghi rõ.',
  },
  {
    key: 'terms',
    language: 'en',
    title: 'Terms of Use',
    body: '[PLACEHOLDER] Your Terms of Use go here. Have a lawyer write or check them before launch.',
  },
  {
    key: 'terms',
    language: 'vi',
    title: 'Điều khoản sử dụng',
    body: '[NỘI DUNG TẠM] Điều khoản sử dụng sẽ được đặt ở đây. Hãy nhờ luật sư soạn hoặc kiểm tra trước khi ra mắt.',
  },
  {
    key: 'privacy',
    language: 'en',
    title: 'Privacy Policy',
    body:
      '[PLACEHOLDER] Your Privacy Policy goes here. Facts it should cover: we strip location (GPS) and camera data from photos before they are stored; ' +
      'you can delete your account and everything you posted from Settings at any time.',
  },
  {
    key: 'privacy',
    language: 'vi',
    title: 'Chính sách quyền riêng tư',
    body:
      '[NỘI DUNG TẠM] Chính sách quyền riêng tư sẽ được đặt ở đây. Cần nêu rõ: chúng tôi xoá dữ liệu vị trí (GPS) và thông tin máy ảnh khỏi ảnh trước khi lưu; ' +
      'bạn có thể xoá tài khoản và mọi nội dung đã đăng trong phần Cài đặt bất cứ lúc nào.',
  },
];
