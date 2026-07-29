import { TranslationManager } from "@/components/translation-manager/translation-manager";

/**
 * 管理画面。ログイン画面は無く、開いたらすぐこの画面が表示される。
 * この Page 自体は Server Component で、対話部分だけが Client Component。
 */
export default function Page() {
  return <TranslationManager />;
}
