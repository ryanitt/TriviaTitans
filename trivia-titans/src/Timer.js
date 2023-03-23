import React, { useState, useRef, useEffect } from "react";
import { Card, Text } from "@mantine/core";

function Timer(props) {
  const [seconds, setSeconds] = useState(props.initialTime);
  const intervalRef = useRef(null);

  useEffect(() => {
    if(props.clicked) {
      props.handleTimer();
      console.log("Amount of time left during submission: ", seconds);
      props.socket.emit("submit-answer", {
        room: props.room,
        username: props.username,
        answerOption: props.answerOption,
        timeLeft: seconds
      });
    } else if (seconds === 0 ) {
      props.handleTimer();
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
