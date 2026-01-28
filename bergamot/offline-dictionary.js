/**
 * Japanese-English Dictionary (Offline)
 * Từ điển offline cho các từ/cụm từ Nhật thông dụng
 * 
 * Format: { japanese: english }
 */

const JA_EN_DICTIONARY = {
  // Greetings - Chào hỏi
  "こんにちは": "Hello",
  "こんばんは": "Good evening",
  "おはよう": "Good morning",
  "おはようございます": "Good morning (polite)",
  "さようなら": "Goodbye",
  "ありがとう": "Thank you",
  "ありがとうございます": "Thank you very much",
  "すみません": "Excuse me / Sorry",
  "ごめんなさい": "I'm sorry",
  "はい": "Yes",
  "いいえ": "No",
  "お願いします": "Please",
  "どうぞ": "Please / Here you go",
  "どういたしまして": "You're welcome",
  
  // Common words - Từ thông dụng
  "日本": "Japan",
  "日本語": "Japanese language",
  "英語": "English",
  "ベトナム": "Vietnam",
  "ベトナム語": "Vietnamese",
  "言語": "Language",
  "翻訳": "Translation",
  "辞書": "Dictionary",
  
  // Time - Thời gian
  "今日": "Today",
  "明日": "Tomorrow",
  "昨日": "Yesterday",
  "今": "Now",
  "時間": "Time",
  "分": "Minute",
  "秒": "Second",
  "年": "Year",
  "月": "Month",
  "日": "Day",
  "週": "Week",
  "朝": "Morning",
  "昼": "Noon / Afternoon",
  "夜": "Night",
  "午前": "AM / Morning",
  "午後": "PM / Afternoon",
  
  // Numbers - Số
  "一": "One (1)",
  "二": "Two (2)",
  "三": "Three (3)",
  "四": "Four (4)",
  "五": "Five (5)",
  "六": "Six (6)",
  "七": "Seven (7)",
  "八": "Eight (8)",
  "九": "Nine (9)",
  "十": "Ten (10)",
  "百": "Hundred (100)",
  "千": "Thousand (1000)",
  "万": "Ten thousand (10000)",
  
  // People - Con người
  "人": "Person",
  "私": "I / Me",
  "あなた": "You",
  "彼": "He",
  "彼女": "She",
  "私たち": "We",
  "友達": "Friend",
  "家族": "Family",
  "父": "Father",
  "母": "Mother",
  "兄": "Older brother",
  "姉": "Older sister",
  "弟": "Younger brother",
  "妹": "Younger sister",
  "子供": "Child",
  "大人": "Adult",
  "男": "Man",
  "女": "Woman",
  "先生": "Teacher",
  "学生": "Student",
  "会社員": "Company employee",
  
  // Places - Địa điểm
  "場所": "Place",
  "家": "House / Home",
  "学校": "School",
  "会社": "Company",
  "駅": "Station",
  "空港": "Airport",
  "病院": "Hospital",
  "店": "Shop",
  "レストラン": "Restaurant",
  "ホテル": "Hotel",
  "銀行": "Bank",
  "郵便局": "Post office",
  "図書館": "Library",
  "公園": "Park",
  "山": "Mountain",
  "川": "River",
  "海": "Sea / Ocean",
  "国": "Country",
  "町": "Town",
  "市": "City",
  
  // Actions - Hành động
  "食べる": "To eat",
  "飲む": "To drink",
  "見る": "To see / watch",
  "聞く": "To hear / listen",
  "話す": "To speak",
  "読む": "To read",
  "書く": "To write",
  "行く": "To go",
  "来る": "To come",
  "帰る": "To return",
  "買う": "To buy",
  "売る": "To sell",
  "待つ": "To wait",
  "歩く": "To walk",
  "走る": "To run",
  "寝る": "To sleep",
  "起きる": "To wake up",
  "働く": "To work",
  "勉強する": "To study",
  "遊ぶ": "To play",
  "使う": "To use",
  "作る": "To make",
  "開ける": "To open",
  "閉める": "To close",
  "始める": "To begin",
  "終わる": "To end",
  
  // Adjectives - Tính từ
  "大きい": "Big",
  "小さい": "Small",
  "新しい": "New",
  "古い": "Old",
  "良い": "Good",
  "悪い": "Bad",
  "高い": "High / Expensive",
  "安い": "Cheap",
  "長い": "Long",
  "短い": "Short",
  "難しい": "Difficult",
  "簡単": "Easy / Simple",
  "面白い": "Interesting",
  "つまらない": "Boring",
  "美味しい": "Delicious",
  "まずい": "Bad tasting",
  "暑い": "Hot (weather)",
  "寒い": "Cold (weather)",
  "熱い": "Hot (touch)",
  "冷たい": "Cold (touch)",
  "忙しい": "Busy",
  "暇": "Free time",
  
  // IT/Tech terms - Thuật ngữ IT
  "コンピュータ": "Computer",
  "パソコン": "PC / Personal Computer",
  "インターネット": "Internet",
  "ウェブサイト": "Website",
  "メール": "Email",
  "パスワード": "Password",
  "ログイン": "Login",
  "ログアウト": "Logout",
  "ダウンロード": "Download",
  "アップロード": "Upload",
  "ファイル": "File",
  "フォルダ": "Folder",
  "データ": "Data",
  "データベース": "Database",
  "サーバー": "Server",
  "クライアント": "Client",
  "ネットワーク": "Network",
  "セキュリティ": "Security",
  "エラー": "Error",
  "バグ": "Bug",
  "テスト": "Test",
  "デバッグ": "Debug",
  "開発": "Development",
  "設計": "Design",
  "実装": "Implementation",
  "検証": "Verification",
  "本番": "Production",
  "環境": "Environment",
  "設定": "Settings / Configuration",
  "入力": "Input",
  "出力": "Output",
  "保存": "Save",
  "削除": "Delete",
  "追加": "Add",
  "編集": "Edit",
  "更新": "Update",
  "検索": "Search",
  "結果": "Result",
  "完了": "Complete",
  "失敗": "Failure",
  "成功": "Success",
  "確認": "Confirm",
  "キャンセル": "Cancel",
  "送信": "Send",
  "受信": "Receive",
  "接続": "Connection",
  "切断": "Disconnect",
  "有効": "Valid / Enabled",
  "無効": "Invalid / Disabled",
  "必須": "Required",
  "任意": "Optional",
  "選択": "Select",
  "一覧": "List",
  "詳細": "Details",
  "概要": "Overview",
  "管理": "Management",
  "権限": "Permission",
  "ユーザー": "User",
  "アカウント": "Account",
  "登録": "Register",
  "解除": "Cancel / Remove",
  "申請": "Application / Request",
  "承認": "Approval",
  "却下": "Rejection",
  "通知": "Notification",
  "警告": "Warning",
  "情報": "Information",
  "ヘルプ": "Help",
  "マニュアル": "Manual",
  "ドキュメント": "Document",
  
  // Business terms - Thuật ngữ kinh doanh
  "会議": "Meeting",
  "予定": "Schedule",
  "報告": "Report",
  "資料": "Materials / Documents",
  "契約": "Contract",
  "請求": "Invoice / Bill",
  "支払い": "Payment",
  "納品": "Delivery",
  "見積もり": "Estimate / Quote",
  "注文": "Order",
  "在庫": "Stock / Inventory",
  "売上": "Sales",
  "利益": "Profit",
  "損失": "Loss",
  "予算": "Budget",
  "計画": "Plan",
  "目標": "Goal",
  "進捗": "Progress",
  "問題": "Problem",
  "解決": "Solution",
  "提案": "Proposal",
  "質問": "Question",
  "回答": "Answer",
  "連絡": "Contact",
  "担当": "In charge",
  "責任": "Responsibility",
  "対応": "Response / Support",
  "確認済み": "Confirmed",
  "未確認": "Unconfirmed",
  "処理中": "Processing",
  "保留": "On hold",
  "完了済み": "Completed",
  
  // Common phrases - Cụm từ thông dụng
  "お疲れ様です": "Thank you for your hard work",
  "よろしくお願いします": "Please take care of this / Nice to meet you",
  "お世話になっております": "Thank you for your continued support",
  "承知しました": "Understood",
  "かしこまりました": "Certainly (formal)",
  "少々お待ちください": "Please wait a moment",
  "申し訳ありません": "I'm very sorry",
  "ご確認ください": "Please confirm",
  "ご連絡ください": "Please contact me",
  "お手数ですが": "I'm sorry to trouble you, but...",
  "以上です": "That's all",
  "以下の通り": "As follows",
  "添付ファイル": "Attached file",
  "ご参考まで": "For your reference",
  "至急": "Urgent",
  "重要": "Important",
  "お知らせ": "Notice / Announcement"
};

// Japanese-Vietnamese Dictionary (Common terms)
const JA_VI_DICTIONARY = {
  // Greetings
  "こんにちは": "Xin chào",
  "こんばんは": "Chào buổi tối",
  "おはよう": "Chào buổi sáng",
  "おはようございます": "Chào buổi sáng (lịch sự)",
  "さようなら": "Tạm biệt",
  "ありがとう": "Cảm ơn",
  "ありがとうございます": "Cảm ơn rất nhiều",
  "すみません": "Xin lỗi / Cho phép",
  "ごめんなさい": "Xin lỗi",
  "はい": "Vâng / Có",
  "いいえ": "Không",
  "お願いします": "Làm ơn",
  
  // Common
  "日本": "Nhật Bản",
  "日本語": "Tiếng Nhật",
  "英語": "Tiếng Anh",
  "ベトナム": "Việt Nam",
  "ベトナム語": "Tiếng Việt",
  "翻訳": "Dịch thuật",
  
  // IT terms
  "設定": "Cài đặt",
  "保存": "Lưu",
  "削除": "Xóa",
  "追加": "Thêm",
  "編集": "Chỉnh sửa",
  "更新": "Cập nhật",
  "検索": "Tìm kiếm",
  "確認": "Xác nhận",
  "キャンセル": "Hủy",
  "送信": "Gửi",
  "完了": "Hoàn thành",
  "エラー": "Lỗi",
  "成功": "Thành công",
  "失敗": "Thất bại"
};

/**
 * Offline Dictionary Translator
 */
class OfflineDictionary {
  constructor() {
    this.jaEnDict = JA_EN_DICTIONARY;
    this.jaViDict = JA_VI_DICTIONARY;
    
    // Tạo reverse lookup cho search
    this.jaEnEntries = Object.entries(JA_EN_DICTIONARY);
    this.jaViEntries = Object.entries(JA_VI_DICTIONARY);
  }

  /**
   * Tìm từ trong từ điển
   * @param {string} text - Text cần dịch
   * @param {string} toLang - Ngôn ngữ đích (en/vi)
   * @returns {string|null} - Bản dịch hoặc null nếu không tìm thấy
   */
  lookup(text, toLang = 'en') {
    const trimmed = text.trim();
    const dict = toLang === 'vi' ? this.jaViDict : this.jaEnDict;
    
    // Exact match
    if (dict[trimmed]) {
      return dict[trimmed];
    }
    
    return null;
  }

  /**
   * Dịch text bằng từ điển offline
   * Tìm các từ/cụm từ đã biết và dịch chúng
   * 
   * @param {string} text - Text cần dịch
   * @param {string} toLang - Ngôn ngữ đích
   * @returns {{translated: string, found: boolean, partial: boolean}}
   */
  translate(text, toLang = 'en') {
    const trimmed = text.trim();
    
    // Thử exact match trước
    const exact = this.lookup(trimmed, toLang);
    if (exact) {
      return { translated: exact, found: true, partial: false };
    }
    
    // Thử tìm các từ/cụm từ trong text
    const dict = toLang === 'vi' ? this.jaViDict : this.jaEnDict;
    const entries = toLang === 'vi' ? this.jaViEntries : this.jaEnEntries;
    
    // Sort by length descending để match cụm từ dài trước
    const sortedEntries = [...entries].sort((a, b) => b[0].length - a[0].length);
    
    let result = trimmed;
    let foundAny = false;
    
    for (const [jp, translation] of sortedEntries) {
      if (result.includes(jp)) {
        result = result.replace(new RegExp(this.escapeRegex(jp), 'g'), `【${translation}】`);
        foundAny = true;
      }
    }
    
    if (foundAny) {
      return { translated: result, found: true, partial: true };
    }
    
    return { translated: null, found: false, partial: false };
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Lấy số lượng entries trong từ điển
   */
  getStats() {
    return {
      jaEn: Object.keys(this.jaEnDict).length,
      jaVi: Object.keys(this.jaViDict).length
    };
  }
}

// Export
if (typeof window !== 'undefined') {
  window.OfflineDictionary = OfflineDictionary;
  window.offlineDictionary = new OfflineDictionary();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OfflineDictionary, JA_EN_DICTIONARY, JA_VI_DICTIONARY };
}
