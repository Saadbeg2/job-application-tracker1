import { isDemoMode } from "@/lib/demoMode";
import ReviewClient from "./review-client";

export default function ReviewPage() {
  return <ReviewClient demoMode={isDemoMode()} />;
}
