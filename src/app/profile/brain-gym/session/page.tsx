import { Metadata } from "next";
import BrainGymClient from "./BrainGymClient";

export const metadata: Metadata = {
  title: "Brain Gym Session | 800 Academy",
  description: "Customized practice session to master your topics.",
};

export default function BrainGymPage() {
  return <BrainGymClient />;
}
