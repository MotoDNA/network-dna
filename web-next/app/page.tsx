import Hero from "@/components/sections/Hero";
import Intro from "@/components/sections/Intro";
import StripeTransition from "@/components/motion/StripeTransition";
import Works from "@/components/sections/Works";
import Sequence from "@/components/sections/Sequence";
import Attitude from "@/components/sections/Attitude";
import Craft from "@/components/sections/Craft";
import Playground from "@/components/sections/Playground";
import Closing from "@/components/sections/Closing";
export default function Home() {
  return (
    <main>
      <Hero />
      <Intro />
      <StripeTransition />
      <Works />
      <Sequence />
      <Attitude />
      <Craft />
      <Playground />
      <Closing />
    </main>
  );
}
