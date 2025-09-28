import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as faceapi from "face-api.js";

interface FaceCaptureProps {
  mode: "enroll" | "verify";
  onFaceCapture?: (descriptor: Float32Array) => void;
  onVerificationResult?: (isMatch: boolean, confidence: number) => void;
  existingDescriptor?: number[] | null;
  className?: string;
}

export default function FaceCapture({ 
  mode, 
  onFaceCapture, 
  onVerificationResult, 
  existingDescriptor,
  className = "" 
}: FaceCaptureProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVideoStarted, setIsVideoStarted] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'detecting' | 'captured' | 'error'>('idle');
  const [enrollmentTriggered, setEnrollmentTriggered] = useState(false);
  const [verificationTriggered, setVerificationTriggered] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Starting to load face-api.js models...');
        setIsLoading(true);
        setIsModelLoaded(false);
        
        // Use CDN for models since we don't have local models set up
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        
        console.log('Face-api.js models loaded successfully');
        setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading face-api.js models:', error);
        setIsModelLoaded(false);
        toast({
          title: "Model Loading Failed",
          description: "Failed to load face recognition models. Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        console.log('Finished loading models, setting isLoading to false');
        setIsLoading(false);
      }
    };

    loadModels();
  }, [toast]);

  // Start camera
  const startCamera = async () => {
    try {
      console.log('Starting camera - Models loaded:', isModelLoaded);
      
      if (!isModelLoaded) {
        toast({
          title: "Models Not Ready",
          description: "Please wait for face recognition models to load.",
          variant: "destructive",
        });
        return;
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // Check for WebGL support (required by face-api.js)
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        throw new Error('WebGL not supported - required for face recognition');
      }

      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      console.log('Camera access granted, setting up video stream');
      
      if (!videoRef.current) {
        console.error('Video ref is null');
        throw new Error('Video element not available');
      }

      const video = videoRef.current;
      console.log('Video element found:', video);
      
      // Set up video properties
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      
      streamRef.current = stream;
      console.log('Stream assigned to video');
      
      // Handle video events
      const handleLoadedMetadata = () => {
        console.log('Video metadata loaded:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        });
        setIsVideoStarted(true);
        setCaptureStatus('detecting');
        setEnrollmentTriggered(false); // Reset enrollment flag when video starts
        setVerificationTriggered(false); // Reset verification flag when video starts
        
        // Start face detection after a short delay to ensure video is playing
        setTimeout(() => {
          startFaceDetection();
        }, 500);
      };

      const handleCanPlay = () => {
        console.log('Video can play');
      };

      const handlePlaying = () => {
        console.log('Video is playing');
      };

      const handleError = (e: any) => {
        console.error('Video error event:', e);
        setCaptureStatus('error');
      };

      // Remove existing event listeners to avoid duplicates
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);

      // Add event listeners
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('error', handleError);
      
      // Manually trigger play
      try {
        await video.play();
        console.log('Video play() succeeded');
      } catch (error) {
        console.error('Video play() failed:', error);
        // Try to set video started anyway in case autoplay works
        setIsVideoStarted(true);
        setCaptureStatus('detecting');
      }
      
      console.log('Video stream setup complete');
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = "Please allow camera access to use face recognition.";
      let errorTitle = "Camera Access Denied";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera access was denied. Please allow camera permissions and try again.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found. Please connect a camera and try again.";
        errorTitle = "Camera Not Found";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Camera is not supported in this browser or requires HTTPS.";
        errorTitle = "Camera Not Supported";
      } else if (error.message.includes('not supported')) {
        errorMessage = "Camera API not supported. Try using Chrome, Firefox, or Safari.";
        errorTitle = "Browser Not Supported";
      } else {
        errorMessage = `Camera error: ${error.message}`;
        errorTitle = "Camera Error";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setCaptureStatus('error');
    }
  };

  // Start face detection loop
  const startFaceDetection = () => {
    console.log('Starting face detection...');
    if (!videoRef.current || !canvasRef.current) {
      console.log('Missing video or canvas ref');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    console.log('Video dimensions:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState
    });

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const detectFaces = async () => {
      if (!video || video.paused || video.ended) {
        console.log('Video not ready:', {
          video: !!video,
          paused: video?.paused,
          ended: video?.ended
        });
        return;
      }

      try {
        console.log('Running face detection...');
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        console.log(`Found ${detections.length} faces`);

        // Clear canvas
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (detections.length > 0) {
          setFaceDetected(true);
          console.log('Face detected with confidence:', detections[0].detection.score);
          
          // Draw detection boxes
          detections.forEach(detection => {
            const { x, y, width, height } = detection.detection.box;
            if (ctx) {
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, width, height);
              
              // Draw confidence
              ctx.fillStyle = '#00ff00';
              ctx.font = '16px Arial';
              ctx.fillText(
                `${Math.round(detection.detection.score * 100)}%`,
                x, y - 10
              );
            }
          });

          // If we have exactly one face, we can proceed
          if (detections.length === 1) {
            const detection = detections[0];
            
            if (mode === "enroll" && onFaceCapture && !enrollmentTriggered) {
              // For enrollment, capture the face descriptor (only once)
              console.log("Triggering face enrollment (first time)");
              setEnrollmentTriggered(true);
              onFaceCapture(detection.descriptor);
              setCaptureStatus('captured');
              stopCamera();
            } else if (mode === "verify" && onVerificationResult && existingDescriptor && !verificationTriggered) {
              // For verification, compare with existing descriptor (only once)
              console.log("Triggering face verification (first time)");
              setVerificationTriggered(true);
              
              const distance = faceapi.euclideanDistance(
                detection.descriptor,
                new Float32Array(existingDescriptor)
              );
              
              // Lower distance means better match (threshold ~0.6 is typical)
              const isMatch = distance < 0.6;
              const confidence = Math.max(0, (1 - distance) * 100);
              
              console.log("Face verification result:", { isMatch, confidence, distance });
              
              onVerificationResult(isMatch, confidence);
              setCaptureStatus(isMatch ? 'captured' : 'error');
              stopCamera();
            }
          }
        } else {
          setFaceDetected(false);
          console.log('No face detected in current frame');
          
          // Draw "no face detected" message
          if (ctx) {
            ctx.fillStyle = '#ff0000';
            ctx.font = '18px Arial';
            ctx.fillText('No face detected', 10, 30);
          }
        }
      } catch (error) {
        console.error('Face detection error:', error);
      }
    };

    // Start detection loop
    console.log('Setting up detection interval...');
    detectionIntervalRef.current = window.setInterval(detectFaces, 100);
  };

  // Stop camera and cleanup
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    setIsVideoStarted(false);
    setFaceDetected(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const getStatusMessage = () => {
    switch (captureStatus) {
      case 'idle':
        return mode === 'enroll' ? 'Ready to capture your face for registration' : 'Ready to verify your identity';
      case 'detecting':
        return faceDetected 
          ? 'Face detected! Hold still...' 
          : 'Please position your face in the camera view';
      case 'captured':
        return mode === 'enroll' ? 'Face captured successfully!' : 'Face verified successfully!';
      case 'error':
        return mode === 'verify' ? 'Face verification failed' : 'Face capture failed';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (captureStatus) {
      case 'detecting':
        return faceDetected ? 'text-warning' : 'text-muted-foreground';
      case 'captured':
        return 'text-success';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className={`border border-border ${className}`}>
      <CardContent className="p-6">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-camera text-primary text-xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {mode === 'enroll' ? 'Face Registration' : 'Face Verification'}
          </h3>
          <p className={`text-sm ${getStatusColor()}`}>
            {getStatusMessage()}
          </p>
        </div>

        <div 
          className="relative bg-gray-900 rounded-lg overflow-hidden mb-4" 
          style={{ width: '100%', height: '400px' }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ 
              width: '100%', 
              height: '100%',
              display: 'block',
              backgroundColor: '#000',
              position: 'relative',
              zIndex: 0
            }}
            data-testid="face-capture-video"
          />
          
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ 
              width: '100%', 
              height: '100%',
              zIndex: 1,
              position: 'absolute'
            }}
            data-testid="face-capture-canvas"
          />
          
          {/* Status overlay */}
          <div className="absolute top-4 left-4 bg-black/80 text-white text-sm px-3 py-2 rounded-md z-20">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isVideoStarted ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isVideoStarted ? 'Camera Active' : 'Camera Inactive'}</span>
            </div>
            <div className="text-xs opacity-75 mt-1">Status: {captureStatus}</div>
          </div>
          
          {/* Loading/Error overlay */}
          {!isVideoStarted && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-10">
              {isLoading && !isModelLoaded ? (
                <div className="text-center text-white">
                  <i className="fas fa-spinner fa-spin text-3xl mb-3"></i>
                  <p className="text-lg">Loading face detection models...</p>
                  <p className="text-sm opacity-75">This may take a few moments</p>
                </div>
              ) : captureStatus === 'error' ? (
                <div className="text-center text-red-400">
                  <i className="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p className="text-lg">Camera Error</p>
                  <p className="text-sm opacity-75">Check camera permissions</p>
                </div>
              ) : !isModelLoaded ? (
                <div className="text-center text-yellow-400">
                  <i className="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p className="text-lg">Models Failed to Load</p>
                  <p className="text-sm opacity-75">Please refresh the page and try again</p>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <i className="fas fa-video text-4xl mb-4"></i>
                  <p className="text-lg">Face detection ready</p>
                  <p className="text-sm opacity-75">Click "Start Camera" to begin</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center space-x-4">
          {!isVideoStarted ? (
            <Button
              onClick={startCamera}
              disabled={isLoading || !isModelLoaded}
              data-testid="button-start-camera"
            >
              <i className="fas fa-play mr-2"></i>
              Start Camera
            </Button>
          ) : (
            <Button
              onClick={stopCamera}
              variant="outline"
              data-testid="button-stop-camera"
            >
              <i className="fas fa-stop mr-2"></i>
              Stop Camera
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 p-4 bg-accent rounded-lg">
          <h4 className="text-sm font-semibold text-foreground mb-2">Instructions:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Ensure good lighting for better detection</li>
            <li>• Keep your face centered in the camera view</li>
            <li>• Hold still when your face is detected</li>
            <li>• Only one face should be visible in the camera</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}