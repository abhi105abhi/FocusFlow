import React, { useState, useEffect } from "react";
import * as JoyrideModule from "react-joyride";

const Joyride = (JoyrideModule as any).default || JoyrideModule;
const { STATUS } = JoyrideModule as any;
type Step = any;
type CallBackProps = any;

export default function AppTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("ff_v3_onboarding_completed");
    if (!hasSeenTour) {
      setRun(true);
    }
  }, []);

  const steps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: "Welcome to FocusFlow! 🌊",
      content: "This is a neurodivergent-optimized task manager that works exactly how your brain does. Let's take a quick look around.",
      disableBeacon: true,
    },
    {
      target: ".tour-capture-btn",
      title: "Capture Intuitively ⚡️",
      content: "Whenever an idea pops into your head, dump it here. You can even use voice dictation. Don't worry about organizing it yet.",
      disableBeacon: true,
    },
    {
      target: ".tour-nav-focus",
      title: "Hyper-Focus Mode 🎯",
      content: "This is where you execute. Only pin tasks here that you are committing to doing right now.",
      disableBeacon: true,
    },
    {
      target: ".tour-nav-primary",
      title: "Primary Directives ⚡️",
      content: "Things that actually need to get done, like paying a bill or a work deadline.",
      disableBeacon: true,
    },
    {
      target: ".tour-nav-dump",
      title: "The Brain Dump 🧠",
      content: "Your inbox. Everything you capture initially lands here waiting to be triaged.",
      disableBeacon: true,
    },
    {
      target: ".tour-user-menu",
      title: "Cloud Syncing ☁️",
      content: "Because you're signed in with Google, everything here instantly synchronizes across all your devices.",
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("ff_v3_onboarding_completed", "true");
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#14b8a6', // teal-500
          textColor: '#0f172a', // slate-900
          arrowColor: '#ffffff',
          backgroundColor: '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.4)',
        },
        buttonBack: { color: '#64748b' }, // slate-500
        tooltipContainer: { textAlign: 'left' }
      }}
    />
  );
}
