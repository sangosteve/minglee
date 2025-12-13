import { useState } from "react";
import { cn } from "@/lib/utils";

const emojiCategories = {
  recent: ["😀", "❤️", "👍", "😂", "🔥", "✨", "🎉", "💯"],
  smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥"],
  gestures: ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "🫵", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "👏", "🙌", "👐", "🙏", "✍️", "💪"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️"],
  objects: ["🔥", "✨", "⭐", "🌟", "💫", "🎉", "🎊", "🎁", "🏆", "🥇", "🏅", "💎", "💰", "💵", "📱", "💻", "⌚", "📷", "🎬", "🎵", "🎶", "🔔", "📌", "📍", "✅", "❌", "❓", "❗", "💯", "🆗", "🆕", "🆒"],
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker = ({ onEmojiSelect, onClose }: EmojiPickerProps) => {
  const [activeCategory, setActiveCategory] = useState<keyof typeof emojiCategories>("recent");

  const categoryLabels: Record<keyof typeof emojiCategories, string> = {
    recent: "Recent",
    smileys: "Smileys",
    gestures: "Gestures",
    hearts: "Hearts",
    objects: "Objects",
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-lg w-72 z-50 animate-scale-in">
      {/* Category Tabs */}
      <div className="flex border-b border-border p-1 gap-1">
        {Object.keys(emojiCategories).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category as keyof typeof emojiCategories)}
            className={cn(
              "flex-1 py-1.5 text-xs rounded-lg transition-colors",
              activeCategory === category
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {categoryLabels[category as keyof typeof emojiCategories]}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-2 h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {emojiCategories[activeCategory].map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
