import { useState, useEffect } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Text, View, Button, StyleSheet, TouchableOpacity } from "react-native";
import { Recording, Sound } from "expo-av/build/Audio";
import { FontAwesome } from "@expo/vector-icons";
import * as fft from "flat-fft";

interface PeakType {
  index: number;
  amplitude: number;
}
const threshold = 0.1;
const App = () => {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [audioPermission, setAudioPermission] = useState(false);
  const [decodedText, setDecodedText] = useState("");
  const [sound, setSounds] = useState<Audio.Sound | null>(null);
  const [Uri, setUri] = useState("");

  async function startRecording() {
    try {
      if (permissionResponse?.status !== "granted") {
        console.log("Requesting permission..");
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("Starting recording..");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setRecordingStatus("recording");
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }
  async function stopRecording() {
    try {
      if (recordingStatus === "recording") {
        console.log("Stopping Recording");
        await recording?.stopAndUnloadAsync();
        const recordingUri = recording?.getURI();

        // Create a file name for the recording
        const fileName = `recording-${Date.now()}.caf`;

        // Move the recording to the new directory with the new file name
        await FileSystem.makeDirectoryAsync(
          FileSystem.documentDirectory + "recordings/",
          { intermediates: true }
        );
        await FileSystem.moveAsync({
          from: recordingUri as string,
          to: FileSystem.documentDirectory + "recordings/" + `${fileName}`,
        });
        setUri(recordingUri as string);

        // This is for simply playing the sound back
        const playbackObject = new Audio.Sound();
        await playbackObject.loadAsync({
          uri: FileSystem.documentDirectory + "recordings/" + `${fileName}`,
        });

        setSounds(playbackObject);
        // start decoding part
        await playbackObject.playAsync();
        processAudioFile(
          FileSystem.documentDirectory + "recordings/" + `${fileName}`
        );
        // resert our states to record again
        setRecording(null);
        setRecordingStatus("stopped");
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
  }

  async function processAudioFile(uri: string) {
    try {
      // Read the audio file as binary
      const audioBuffer = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert Base64 to binary data
      const binaryData = Uint8Array.from(atob(audioBuffer), (c) =>
        c.charCodeAt(0)
      );

      // Convert binary data to Float32Array
      const audioData = new Float32Array(binaryData.length / 2);
      for (let i = 0; i < binaryData.length; i += 2) {
        const value = (binaryData[i] | (binaryData[i + 1] << 8)) / 32767;
        audioData[i / 2] = value;
      }

      // Perform FFT on the audio data
      console.log("Performing FFT...");
      const fftResult = fft.fft32(audioData);
      const maxAmplitude = Math.max(...fftResult.map((x) => Math.abs(x)));
      for (let i = 0; i < fftResult.length; i++) {
        fftResult[i] /= maxAmplitude;
      }
      // Log the FFT result (use a small slice for readability)
      console.log("FFT Result (first 20 values):", fftResult.slice(0, 20));

      // Analyze the frequency spectrum for Morse code signals
      const morseCodeSequence = analyzeFrequencySpectrum(fftResult);
      console.log("Decoded Morse Code Sequence:", morseCodeSequence);

      return morseCodeSequence;
    } catch (error) {
      console.error("Error processing audio file:", error);
      return "";
    }
  }
  function analyzeFrequencySpectrum(fftResult: Float32Array) {
    const morseCodeSequence = [];

    const targetFrequency = 1000; // Hz
    const dotDurationThreshold = 200; // ms
    const dashDurationThreshold = 600; // ms
    const silenceThreshold = 10; // Amplitude threshold for silence detection
    const sampleRate = 44100; // Hz
    const fftSize = fftResult.length;

    // Calculate the index of the target frequency in the FFT result
    const targetIndex = Math.round((targetFrequency * fftSize) / sampleRate);
    console.log(`Target Index for ${targetFrequency} Hz: ${targetIndex}`);

    // Log values around the target frequency for better insight
    const logRange = fftResult.slice(targetIndex - 20, targetIndex + 20);
    console.log(`FFT Amplitudes around 1000 Hz:`, logRange);

    let isSoundDetected = false;
    let startSample = 0;
    let endSample = 0;

    for (let i = 0; i < fftSize; i++) {
      const amplitude = fftResult[targetIndex];

      // Detect if the amplitude at the target frequency is above the threshold
      if (amplitude > silenceThreshold) {
        if (!isSoundDetected) {
          // Start of a new sound
          isSoundDetected = true;
          startSample = i;
        }
      } else {
        if (isSoundDetected) {
          // End of the detected sound
          endSample = i;
          const duration = ((endSample - startSample) / sampleRate) * 1000; // Duration in ms

          // Determine if it is a dot or dash
          if (
            duration >= dotDurationThreshold &&
            duration < dashDurationThreshold
          ) {
            morseCodeSequence.push(".");
          } else if (duration >= dashDurationThreshold) {
            morseCodeSequence.push("-");
          }

          // Reset sound detection
          isSoundDetected = false;
        }
      }
    }

    console.log("Final Morse Code Sequence:", morseCodeSequence.join(""));
    return morseCodeSequence.join("");
  }

  async function handleRecordButtonPress() {
    if (recordingStatus === "recording") {
      await stopRecording();
      if (Uri) {
        console.log("Saved audio file to", Uri);
      }
    } else {
      await startRecording();
    }
  }
  useEffect(() => {
    // Simply get recording permission upon first render
    async function getPermission() {
      await Audio.requestPermissionsAsync()
        .then((permission) => {
          console.log("Permission Granted: " + permission.granted);
          setAudioPermission(permission.granted);
        })
        .catch((error) => {
          console.log(error);
        });
    }

    // Call function to get permission
    getPermission();
    // Cleanup upon first render
    return () => {
      if (recording) {
        stopRecording();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleRecordButtonPress}>
        <FontAwesome
          name={recording ? "stop-circle" : "circle"}
          size={64}
          color="white"
        />
      </TouchableOpacity>
      <Text
        style={styles.recordingStatusText}
      >{`Recording status: ${recordingStatus}`}</Text>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "red",
  },
  recordingStatusText: {
    marginTop: 16,
  },
});
