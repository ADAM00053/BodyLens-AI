
const photoInput = document.getElementById("photoInput");
const preview = document.getElementById("preview");
const previewBox = document.getElementById("previewBox");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const message = document.getElementById("message");
const buttonText = document.getElementById("buttonText");
const results = document.getElementById("results");
const poseResult = document.getElementById("poseResult");
const confidenceResult = document.getElementById("confidenceResult");
const detailsText = document.getElementById("detailsText");

let selectedImage = null;
let poseLandmarker = null;
let modelPromise = null;
let imageURL = null;

function showMessage(text, isError = false) {
  if (!message) return;

  message.textContent = text;
  message.style.color = isError ? "#ff6b6b" : "";
}

function checkElements() {
  const required = {
    photoInput,
    preview,
    analyzeBtn,
    clearBtn,
    message,
    results,
    poseResult,
    confidenceResult,
    detailsText
  };

  const missing = Object.entries(required)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error(
      "BodyLens: عناصر HTML غير موجودة:",
      missing
    );

    showMessage(
      "فيه عناصر ناقصة في index.html: " +
        missing.join(", "),
      true
    );

    return false;
  }

  return true;
}

async function loadPoseModel() {
  if (poseLandmarker) {
    return poseLandmarker;
  }

  if (modelPromise) {
    return modelPromise;
  }

  modelPromise = (async () => {
    showMessage("جاري تحميل أداة تحليل الصورة...");

    // تحميل مكتبة MediaPipe
    const visionModule = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs"
    );

    const { FilesetResolver, PoseLandmarker } =
      visionModule;

    // تحميل ملفات WASM من نفس إصدار المكتبة
    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
      );

    // تحميل نموذج اكتشاف وضع الجسم
    const model =
      await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "CPU"
          },
          runningMode: "IMAGE",
          numPoses: 1
        }
      );

    poseLandmarker = model;
    return model;
  })();

  try {
    return await modelPromise;
  } catch (error) {
    modelPromise = null;
    throw error;
  }
}

function handleImageSelection() {
  const file = photoInput.files?.[0];

  selectedImage = null;
  results.hidden = true;

  if (imageURL) {
    URL.revokeObjectURL(imageURL);
    imageURL = null;
  }

  if (!file) {
    preview.removeAttribute("src");
    showMessage("اختَر صورة أولاً.");
    return;
  }

  if (!file.type.startsWith("image/")) {
    photoInput.value = "";
    preview.removeAttribute("src");

    showMessage(
      "الملف المختار مش صورة. اختَر ملف صورة صالح.",
      true
    );

    return;
  }

  imageURL = URL.createObjectURL(file);

  preview.onload = () => {
    selectedImage = preview;

    showMessage(
      "الصورة جاهزة. اضغط على زر تحليل الصورة."
    );
  };

  preview.onerror = () => {
    selectedImage = null;

    showMessage(
      "تعذّر عرض الصورة. جرّب صورة تانية.",
      true
    );
  };

  preview.src = imageURL;

  if (previewBox) {
    previewBox.hidden = false;
  }
}

async function analyzeImage() {
  if (!selectedImage || !selectedImage.complete) {
    showMessage(
      "اختَر صورة وانتظر لحد ما تظهر بالكامل.",
      true
    );

    return;
  }

  analyzeBtn.disabled = true;

  if (buttonText) {
    buttonText.textContent = "جاري التحليل...";
  }

  results.hidden = true;

  try {
    const landmarker = await loadPoseModel();

    showMessage(
      "جاري تحليل وضع الجسم في الصورة..."
    );

    const detection = landmarker.detect(selectedImage);
    const poses = detection.landmarks || [];

    if (poses.length === 0) {
      poseResult.textContent =
        "لم يتم اكتشاف جسم بوضوح";

      confidenceResult.textContent = "غير متاح";

      detailsText.textContent =
        "جرّب صورة بإضاءة جيدة يظهر فيها الجسم بوضوح، " +
        "مع مساحة كافية حول الشخص.";

      results.hidden = false;

      showMessage(
        "لم أتمكن من اكتشاف وضع الجسم في الصورة.",
        true
      );

      return;
    }

    const landmarks = poses[0];

    const visiblePoints = landmarks.filter(
      point =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        (
          point.visibility == null ||
          point.visibility > 0.5
        )
    );

    const visibilityPercent = Math.round(
      (visiblePoints.length / landmarks.length) * 100
    );

    poseResult.textContent = "تم اكتشاف الجسم";

    confidenceResult.textContent =
      `${visibilityPercent}% من نقاط الجسم واضحة`;

    detailsText.textContent =
      "ده تحليل بصري لنقاط الجسم الظاهرة في الصورة، " +
      "وليس قياسًا دقيقًا للوزن أو محيط الجسم. " +
      "دقة الكشف بتتأثر بوضعية الشخص والإضاءة والملابس " +
      "ومدى ظهور الجسم.";

    results.hidden = false;

    showMessage("اكتمل التحليل بنجاح!");
  } catch (error) {
    console.error("BodyLens error:", error);

    let friendlyMessage =
      "حصل خطأ أثناء التحليل. افتح Console وشوف رسالة الخطأ الحمراء.";

    if (
      error instanceof TypeError &&
      /fetch|import|network/i.test(error.message)
    ) {
      friendlyMessage =
        "تعذّر تحميل مكتبة التحليل أو نموذج الذكاء الاصطناعي. " +
        "تأكد من اتصال الإنترنت وحاول مرة تانية.";
    }

    showMessage(friendlyMessage, true);
  } finally {
    analyzeBtn.disabled = false;

    if (buttonText) {
      buttonText.textContent = "حلّل الصورة";
    }
  }
}

function clearImage() {
  photoInput.value = "";
  selectedImage = null;
  results.hidden = true;

  if (imageURL) {
    URL.revokeObjectURL(imageURL);
    imageURL = null;
  }

  preview.removeAttribute("src");

  showMessage("اختَر صورة جديدة للبدء.");

  if (previewBox) {
    previewBox.hidden = true;
  }
}

if (checkElements()) {
  photoInput.addEventListener(
    "change",
    handleImageSelection
  );

  analyzeBtn.addEventListener(
    "click",
    analyzeImage
  );

  clearBtn.addEventListener(
    "click",
    clearImage
  );
}
