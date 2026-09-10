import { dlg } from "../../types/dialogue";

/** time.morning */
export const timeMorning = [
  dlg("time.morning.1", "早安~", 10),
  dlg("time.morning.2", "早睡早起真棒！", 10),
  dlg("time.morning.6", "今天准备先做什么？", 4),
  dlg("time.morning.7", "一起慢慢进入状态~", 4, "gentle"),
  dlg("time.morning.9", "今天早上我就开始陪你啦！", 4),
  dlg("time.morning.10", "又Jane面了", 4),
  dlg("time.morning.11", "新的一天!", 10),
  dlg("time.morning.12", "吃早饭了吗~", 10, "gentle"),
  dlg("time.morning.16", "喝杯咖啡！", 10),
  dlg("time.morning.20", "开工！", 10),
];

/** time.afternoon — long computer use during the day. */
export const timeAfternoon = [
  dlg("time.afternoon.1", "最珍贵的是眼前看到的~", 10),
  dlg("time.afternoon.2", "我们都是这耀眼的瞬间！", 10),
  dlg("time.afternoon.3", "我在这里呀~", 4),
  dlg("time.afternoon.4", "就在这里呀~", 4),
  dlg("time.afternoon.5", "我从远方赶来，赴你一面之约", 4),
  dlg("time.afternoon.6", "像夏花一样绚烂！", 4, "teasing"),
  dlg("time.afternoon.7", "快乐无价！", 4),
  dlg("time.afternoon.7", "听首歌休息一下吧~", 4),
];

/** time.evening — softens and quiets down. */
export const timeEvening = [
  dlg("time.evening.1", "为何不释放！", 10, "gentle"),
  dlg("time.evening.2", "一起来拍拍手，仰起头！", 10, "gentle"),
  dlg("time.evening.3", "击倒沮丧！", 10, "gentle"),
  dlg("time.evening.4", "绚烂吧，迷人光芒", 4, "gentle"),
  dlg("time.evening.5", "差不多就收吧。", 4, "gentle"),
  dlg("time.evening.6", "晚上效率还挺高？", 4, "gentle"),
  dlg("time.evening.7", "别把什么都留到今天。", 4, "gentle"),
  dlg("time.evening.8", "做不完也没关系，明天还能继续。", 4, "gentle"),
  dlg("time.evening.9", "今天已经够久了。", 4, "gentle"),
  dlg("time.evening.10", "要不要收尾了。", 4, "gentle"),
  dlg("time.evening.11", "剩下的明天再说。", 4, "gentle"),
  dlg("time.evening.12", "晚上就别跟自己较劲了。", 4, "gentle"),
  dlg("time.evening.13", "看起来你还不准备停。", 4, "gentle"),
  dlg("time.evening.14", "今天辛苦了。", 10, "gentle"),
  dlg("time.evening.15", "再做一会儿？", 10, "gentle"),
  dlg("time.evening.16", "最后一件？", 4, "gentle"),
  dlg("time.evening.17", "你每次说最后一点。", 4, "teasing"),
  dlg("time.evening.18", "我已经不太信“马上就好”了。", 4, "teasing"),
  dlg("time.evening.19", "行吧，我再陪你一会儿。", 4, "gentle"),
  dlg("time.evening.20", "但别太晚。", 4, "gentle"),
];

/** time.lateNight — very low frequency. */
export const timeLateNight = [
  dlg("time.lateNight.1", "我该向谁诉说~~", 10, "concerned"),
  dlg("time.lateNight.2", "Midnight，你睡觉了嘛~", 10, "concerned"),
  dlg("time.lateNight.3", "Goodnight，你听到了嘛~", 10, "concerned"),
  dlg("time.lateNight.4", "世界多么的喧哗，我想安静一下~", 4, "concerned"),
  dlg("time.lateNight.5", "你别太晚睡~少喝几杯~", 4, "concerned"),
  dlg("time.lateNight.6", "她熄掉晚灯，幽幽掩两肩~", 4, "concerned"),
  dlg("time.lateNight.7", "我好想念~我好想你~", 4, "concerned"),
];

/** time.deepNight.rare — very-low-probability, after midnight. */
export const timeDeepNightRare = [
  dlg("time.deepNight.rare.1", "今夜的风是那样吝啬~~", 1, "rare"),
  dlg("time.deepNight.rare.2", "送你一个好梦，晚安~", 1, "rare"),
  dlg("time.deepNight.rare.3", "这么晚是在想我吗~", 1, "rare"),
  dlg("time.deepNight.rare.4", "不知道你会想我吗~", 1, "rare"),
];
