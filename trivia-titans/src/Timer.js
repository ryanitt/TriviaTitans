import React, { useState, useRef, useEffect } from "react";
import { Card, Text } from "@mantine/core";

function Timer(props) {
  const [seconds, setSeconds] = useState(props.initialTime);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (seconds === 0 || props.clicked) {
      props.handleTimer();
      setTimeout(() => {
        setSeconds(props.initialTime);
      }, 3000);
    } else {
      intervalRef.current = setInterval(() => {
        if (seconds === 0) {
          clearInterval(intervalRef.current);
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    }

    return () => clearInterval(intervalRef.current);
  }, [seconds]);

  return (
    <div>
      <Card bg="#393f4a" shadow="sm" radius="md" sx={{ width: 100 }}>
        <Text size="xl" fw={500} ta="center">
          {seconds.toLocaleString("en-US", { minimumIntegerDigits: 2 })}
        </Text>
      </Card>
    </div>
  );
}

export default Timer;
