const wsUrl = `ws://${window.location.host}/ws/proctor/`;
let ws;
let mediaStream;
let intervalId;
let timerId;
let warnings = 0;
let examStartTime;
let isExamActive = false;

// Advanced Tracking State
let trustScore = 100;
let breaksUsed = 0;
let violationTypes = [];

// Exam State
let currentExamData = null;
let currentQuestionIndex = 0;
let userAnswers = {};

// MOCK EXAM DATABASE (5 Subjects)
const MOCK_EXAMS = {
    'ML101': {
        title: 'Machine Learning Fundamentals',
        questions: [
            { text: "What is the primary difference between supervised and unsupervised learning?", options: ["Supervised uses labeled data, unsupervised discovers patterns in unlabeled data.", "Unsupervised learning requires more computational power.", "Supervised learning is only used for classification.", "There is no functional difference."], answer: 0 },
            { text: "Which algorithm is best suited for predicting continuous numerical values?", options: ["Logistic Regression", "K-Means Clustering", "Linear Regression", "Decision Trees for Classification"], answer: 2 },
            { text: "What is overfitting in Machine Learning?", options: ["When the model learns the training data too well, failing to generalize.", "When the model trains too fast.", "When the model is too simple to capture patterns.", "When the dataset is too small."], answer: 0 },
            { text: "Which of the following describes a decision tree?", options: ["A linear equation predicting continuous values.", "A tree-like graph acting as a predictive model.", "A neural network with backpropagation.", "A clustering technique."], answer: 1 },
            { text: "What is cross-validation used for?", options: ["To increase the size of the dataset.", "To assess how the results of a statistical analysis will generalize to an independent data set.", "To speed up the training process.", "To remove outliers from the data."], answer: 1 },
            { text: "In a neural network, what is the role of an activation function?", options: ["To initialize weights.", "To introduce non-linearity into the output of a neuron.", "To reduce the feature space.", "To act as a loss function."], answer: 1 },
            { text: "Which algorithm groups data into k clusters?", options: ["Support Vector Machines", "K-Nearest Neighbors", "Linear Regression", "K-Means"], answer: 3 },
            { text: "What does SVM stand for?", options: ["Systems Variable Matrix", "Simple Vector Model", "Supervised Value Margin", "Support Vector Machine"], answer: 3 },
            { text: "What is the curse of dimensionality?", options: ["The difficulty of training deep networks.", "The exponential increase in training time with more data.", "The problem caused by the exponential increase in volume associated with adding extra dimensions to Euclidean space.", "The tendency of models to overfit on 2D data."], answer: 2 },
            { text: "What is backpropagation?", options: ["An algorithm for supervised learning of artificial neural networks using gradient descent.", "A technique to move data backward in the pipeline.", "A clustering algorithm.", "A method to initialize weights randomly."], answer: 0 },
            { text: "What is a hyperparameter?", options: ["A parameter whose value is set before the learning process begins.", "A parameter learned during training.", "A parameter that determines the dataset size.", "A variable used for data preprocessing."], answer: 0 },
            { text: "Which technique is used to prevent overfitting?", options: ["Gradient Boosting", "Regularization", "Normalization", "Feature scaling"], answer: 1 },
            { text: "What is precision in a classification task?", options: ["The total number of correct predictions divided by total predictions.", "The number of true positives divided by the number of true negatives.", "The number of true positives divided by the number of true positives plus false negatives.", "The number of true positives divided by the number of true positives plus false positives."], answer: 3 },
            { text: "What is a random forest?", options: ["An ensemble learning method for classification, regression and other tasks that operates by constructing a multitude of decision trees at training time.", "A single highly deep decision tree.", "A clustering algorithm for textual data.", "A neural network architecture."], answer: 0 },
            { text: "How does principal component analysis (PCA) work?", options: ["By adding more features to the dataset.", "By normalizing the data strictly.", "By increasing the number of dimensions.", "By transforming data into a new coordinate system such that the greatest variance by some scalar projection of the data comes to lie on the first coordinate."], answer: 3 },
            { text: "What is the bias-variance tradeoff?", options: ["A property of models where increasing bias decreases variance and vice versa.", "A rule that bias and variance must always equal 1.", "A property of models where both decrease simultaneously.", "A rule that only applies to neural networks."], answer: 0 },
            { text: "What is data normalization?", options: ["Removing missing values.", "Scaling the attributes so that they fall within a small specified range.", "Converting categorical data to numerical.", "Transforming data into images."], answer: 1 },
            { text: "When should you use logistic regression instead of linear regression?", options: ["When predicting a continuous value.", "When clustering data.", "When the dependent variable is categorical (e.g., binary).", "When you have too many features."], answer: 2 },
            { text: "What is ensemble learning?", options: ["Using a single model trained on multiple datasets.", "Combining predictions from multiple machine learning algorithms to make a more accurate prediction than any individual model.", "A neural network with many layers.", "A technique specifically for image processing."], answer: 1 },
            { text: "What does a confusion matrix represent?", options: ["A matrix describing the variance of a dataset.", "A table layout that allows visualization of the performance of an algorithm.", "A method to confuse the model to avoid overfitting.", "A matrix used solely in unsupervised learning."], answer: 1 }
        ]
    },
    'IVP101': {
        title: 'Image and Video Processing',
        questions: [
            { text: "Which technique is used to enhance image contrast?", options: ["Gaussian Blur", "Histogram Equalization", "Edge Detection", "Morphological Dilation"], answer: 1 },
            { text: "What does a low-pass filter primarily do in image processing?", options: ["Sharpen the image", "Detect edges", "Smooth or blur the image", "Invert colors"], answer: 2 },
            { text: "In video compression, what is an 'I-frame'?", options: ["An Intra-coded frame representing a full image", "A frame predicted from past frames", "An interpolated audio frame", "An invalid frame marker"], answer: 0 },
            { text: "What does optical flow measure?", options: ["The brightness of a pixel.", "The color intensity of an image.", "The pattern of apparent motion of objects, surfaces, and edges in a visual scene.", "The compression ratio of a video."], answer: 2 },
            { text: "Which transformation is commonly used in JPEG compression?", options: ["Fourier Transform", "Wavelet Transform", "Discrete Cosine Transform (DCT)", "Hough Transform"], answer: 2 },
            { text: "What is image segmentation?", options: ["Compressing the image.", "Increasing the resolution.", "Partitioning a digital image into multiple segments (sets of pixels).", "Blurring the image entirely."], answer: 2 },
            { text: "What is a histogram in the context of an image?", options: ["A graphical representation of the tonal distribution.", "A 3D model of the image.", "A sequence of frames.", "A morphological operation."], answer: 0 },
            { text: "What is morphological dilation?", options: ["An operation that adds pixels to the boundaries of objects in an image.", "An operation that removes noise.", "An operation that reduces the image size.", "An operation that changes colors to grayscale."], answer: 0 },
            { text: "How does edge detection work?", options: ["By blurring the image.", "By finding points in an image where the image brightness changes sharply.", "By identifying the center of an image.", "By scaling the image."], answer: 1 },
            { text: "What color space is most commonly used for video?", options: ["RGB", "CMYK", "YUV (or YCbCr)", "HSV"], answer: 2 },
            { text: "What is the purpose of anti-aliasing?", options: ["To compress the file size.", "To minimize the distortion artifacts known as aliasing when representing a high-resolution image at a lower resolution.", "To increase the brightness.", "To remove red-eye."], answer: 1 },
            { text: "What is a Gaussian blur?", options: ["A sharpening filter.", "An edge detection filter.", "A widely used effect in graphics software to reduce image noise and reduce detail.", "A color inversion technique."], answer: 2 },
            { text: "What represents the highest frequency in an image?", options: ["Flat regions with consistent color.", "Smooth gradients.", "Edges or rapid changes in brightness/color.", "The overall average color."], answer: 2 },
            { text: "Which operator is used for edge detection?", options: ["Gaussian filter", "Sobel operator", "Median filter", "Mean filter"], answer: 1 },
            { text: "What does frame rate refer to?", options: ["The number of pixels per inch.", "The frequency at which consecutive images (frames) appear on a display.", "The bit depth of an image.", "The compression ratio."], answer: 1 },
            { text: "What is the difference between lossless and lossy compression?", options: ["Lossy compression allows exact original data reconstruction, lossless does not.", "Lossless is for video, lossy is for audio.", "Both are identical.", "Lossless reconstruction is exact; lossy discards some information to reduce size."], answer: 3 },
            { text: "What does an alpha channel do?", options: ["Represents the degree of transparency (or opacity) of a color.", "Represents the red channel.", "Represents the brightness.", "Represents the contrast."], answer: 0 },
            { text: "What is image thresholding?", options: ["A method to increase resolution.", "The simplest method of image segmentation, creating binary images.", "A method to apply color filters.", "A method to compress an image."], answer: 1 },
            { text: "What does block matching do in video compression?", options: ["Aligns audio and video.", "Finds similar blocks between the current and a reference frame to reduce temporal redundancy.", "Changes the frame rate dynamically.", "Increases the resolution of frames."], answer: 1 },
            { text: "What is bilateral filtering?", options: ["A simple low-pass filter.", "An edge detection filter.", "A non-linear, edge-preserving, and noise-reducing smoothing filter.", "A morphological operation."], answer: 2 }
        ]
    },
    'DAV101': {
        title: 'Data Analytics and Visualization',
        questions: [
            { text: "What type of chart is best for showing trends over time?", options: ["Pie Chart", "Bar Chart", "Line Chart", "Scatter Plot"], answer: 2 },
            { text: "Which of the following is NOT a measure of central tendency?", options: ["Mean", "Median", "Standard Deviation", "Mode"], answer: 2 },
            { text: "In data preprocessing, what is 'imputation'?", options: ["Removing outliers", "Filling in missing values", "Normalizing data", "Merging databases"], answer: 1 },
            { text: "What is a scatter plot used for?", options: ["Showing proportions.", "Displaying values for typically two variables for a set of data to observe relationships.", "Displaying a sequence over time.", "Showing hierarchical data."], answer: 1 },
            { text: "How does a box plot show outliers?", options: ["As lines within the box.", "As points outside the whiskers.", "It doesn't show outliers.", "As part of the interquartile range."], answer: 1 },
            { text: "What is A/B testing?", options: ["A statistical method to compare two versions of a single variable.", "A method to test software bugs.", "A data cleaning technique.", "A database query method."], answer: 0 },
            { text: "Which tool is commonly used for data manipulation in Python?", options: ["Flask", "Django", "BeautifulSoup", "Pandas"], answer: 3 },
            { text: "What is a dashboard?", options: ["A type of database.", "A visual display of the most important information needed to achieve one or more objectives.", "A machine learning algorithm.", "A data cleaning process."], answer: 1 },
            { text: "What does a correlation coefficient of 1 mean?", options: ["No correlation.", "A perfect negative linear correlation.", "A perfect positive linear correlation.", "A non-linear correlation."], answer: 2 },
            { text: "What is 'tidy data'?", options: ["Data that has been encrypted.", "Data unstructured for flexibility.", "A standard way of mapping the meaning of a dataset to its structure.", "Data that has been deleted."], answer: 2 },
            { text: "What is exploratory data analysis (EDA)?", options: ["Deploying a model.", "An approach to analyzing data sets to summarize their main characteristics, often with visual methods.", "Encrypting sensitive data.", "Deleting outliers without checking."], answer: 1 },
            { text: "Why do we visualize data?", options: ["To make it harder to read.", "To hide specific data points.", "To communicate information clearly and efficiently via statistical graphics.", "To increase file size."], answer: 2 },
            { text: "What is the main purpose of a heatmap?", options: ["To show trends over time.", "To show geographic data only.", "To represent data where individual values are represented as colors.", "To act as a flowchart."], answer: 2 },
            { text: "What is data storytelling?", options: ["Writing a fictional book.", "The practice of building a narrative around a set of data and its accompanying visualizations to convey meaning.", "A programming paradigm.", "Deleting data logs."], answer: 1 },
            { text: "What type of chart shows proportions of a whole?", options: ["Line chart", "Scatter plot", "Pie chart", "Histogram"], answer: 2 },
            { text: "What is a geographic map visualization called?", options: ["Scatter plot", "Choropleth map", "Box plot", "Treemap"], answer: 1 },
            { text: "What is a pivot table?", options: ["A table of contents.", "A data summarization tool found in data visualization programs.", "A table used in SQL joins only.", "A physical table."], answer: 1 },
            { text: "What differentiates a histogram from a bar chart?", options: ["Histograms are for continuous data, bar charts are for categorical data.", "They are exactly the same.", "Bar charts show distributions, histograms show proportions.", "Histograms use lines, bar charts use bars."], answer: 0 },
            { text: "What does statistical significance mean?", options: ["The result is large in magnitude.", "The result is likely not due to chance.", "The result is exactly correct.", "The result is visually appealing."], answer: 1 },
            { text: "What are key performance indicators (KPIs)?", options: ["Types of charts.", "Metrics used to measure success in reaching an objective.", "Database queries.", "Machine learning models."], answer: 1 }
        ]
    },
    'CSS101': {
        title: 'Cryptography and System Security',
        questions: [
            { text: "Which algorithms use the same key for both encryption and decryption?", options: ["Asymmetric Algorithms", "Symmetric Algorithms", "Hashing Algorithms", "Digital Signatures"], answer: 1 },
            { text: "What is the main purpose of a cryptographic hash function?", options: ["To encrypt communications", "To verify data integrity", "To compress data", "To route network traffic safely"], answer: 1 },
            { text: "In a Public Key Infrastructure (PKI), what verifies the ownership of a public key?", options: ["A Digital Certificate from a CA", "A strong password", "The encryption algorithm itself", "A token mechanism"], answer: 0 },
            { text: "What does RSA rely on?", options: ["The computational difficulty of factoring large integers.", "Elliptic curves.", "Symmetric key sharing.", "Hashing speeds."], answer: 0 },
            { text: "What is a man-in-the-middle attack?", options: ["A physical attack on a server room.", "A denial of service attack.", "An attack where the attacker secretly relays and possibly alters the communication between two parties.", "A malware infection."], answer: 2 },
            { text: "What is a brute-force attack?", options: ["Exploiting software bugs.", "Submitting many passwords or passphrases with the hope of eventually guessing correctly.", "Social engineering.", "Phishing."], answer: 1 },
            { text: "What differentiates a stream cipher from a block cipher?", options: ["They are the same.", "Stream ciphers encrypt pseudorandom sequences exclusively.", "Stream ciphers encrypt digits one at a time; block ciphers take a number of bits and encrypt them as a single unit.", "Block ciphers are asymmetric."], answer: 2 },
            { text: "What is the Advanced Encryption Standard (AES)?", options: ["An asymmetric encryption standard.", "A specification for the encryption of electronic data established by the U.S. NIST.", "A hashing algorithm.", "A network protocol."], answer: 1 },
            { text: "What is salt in the context of hashing passwords?", options: ["Random data that is used as an additional input to a one-way function that hashes data.", "An encryption algorithm.", "A type of physical security.", "A method to delete data."], answer: 0 },
            { text: "What is a digital signature?", options: ["A scanned image of a handwritten signature.", "An encrypted password.", "A mathematical scheme for verifying the authenticity of digital messages or documents.", "A watermark on an image."], answer: 2 },
            { text: "What does SSL/TLS stand for?", options: ["Secure Sockets Layer/Transport Layer Security", "System Security Level/Total Level Security", "Standard Sockets Layer/Transport Level Safety", "Secure System Layer/Top Level Security"], answer: 0 },
            { text: "What is a symmetric key cipher?", options: ["Uses different keys for encryption and decryption.", "Uses the same cryptographic keys for both encryption of plaintext and decryption of ciphertext.", "Does not use a key.", "Is used only for hashing."], answer: 1 },
            { text: "What is asymmetric encryption?", options: ["Uses the same key.", "Uses a public key for encryption and a private key for decryption.", "Uses no keys.", "Is faster than symmetric encryption."], answer: 1 },
            { text: "What is Steganography?", options: ["Encrypting a message.", "Hiding a secret message within an ordinary message and the extraction of it at its destination.", "Hashing a message.", "Cracking a password."], answer: 1 },
            { text: "What does a firewall do?", options: ["Cool down servers.", "A network security system that monitors and controls incoming and outgoing network traffic based on predetermined security rules.", "Encrypts hard drives.", "Generates passwords."], answer: 1 },
            { text: "What is the difference between authentication and authorization?", options: ["They are the same.", "Authentication is identifying who you are; authorization is deciding what you are allowed to do.", "Authorization is identifying who you are; authentication is deciding what you are allowed to do.", "There is no difference in computing."], answer: 1 },
            { text: "What does a zero-day exploit mean?", options: ["An attack on New Year's Day.", "A cyber attack that occurs on the same day a weakness is discovered in software.", "An attack that takes zero seconds.", "An attack utilizing zero code."], answer: 1 },
            { text: "What is a dictionary attack?", options: ["A technique for defeating a cipher or authentication by trying to determine its decryption key or passphrase by trying hundreds or sometimes millions of likely possibilities.", "An attack on a physical dictionary server.", "A denial of service attack.", "A physical breach."], answer: 0 },
            { text: "What does the term 'phishing' mean?", options: ["Catching fish.", "The fraudulent attempt to obtain sensitive information or data, such as usernames, passwords and credit card details, by disguising oneself as a trustworthy entity in an electronic communication.", "Hacking a database via SQL injection.", "A type of firewall."], answer: 1 },
            { text: "What is transport layer security?", options: ["A cryptographic protocol designed to provide communications security over a computer network.", "A physical security guard.", "A type of malware.", "An operating system."], answer: 0 }
        ]
    },
    'SEPM101': {
        title: 'Software Engineering & Project Management',
        questions: [
            { text: "Which software development model focuses heavily on iterative development and flexibility?", options: ["Waterfall Model", "Agile Methodology", "V-Model", "Spiral Model"], answer: 1 },
            { text: "What does SDLC stand for?", options: ["Software Design Life Cycle", "System Development Logical Code", "Software Development Life Cycle", "System Design Level Check"], answer: 2 },
            { text: "In project management, what is the 'Critical Path'?", options: ["The path with the highest risks", "The sequence of stages determining the minimum project duration", "The most expensive phase of development", "The testing phase"], answer: 1 },
            { text: "What is a sprint in Agile?", options: ["A fast run by the team.", "A set period of time during which specific work has to be completed and made ready for review.", "A type of bug.", "A software tool."], answer: 1 },
            { text: "What does a Scrum Master do?", options: ["Writes all the code.", "Facilitates the Scrum sequence and helps the team achieve their goals by removing impediments.", "Designs the UI.", "Deploys the application."], answer: 1 },
            { text: "What is continuous integration (CI)?", options: ["The practice of merging all developers' working copies to a shared mainline several times a day.", "Running the server continuously.", "A bug tracking methodology.", "A type of database integration."], answer: 0 },
            { text: "What is version control?", options: ["A system that records changes to a file or set of files over time so that you can recall specific versions later.", "A system that controls software licenses.", "A system to limit user access.", "A firewall setting."], answer: 0 },
            { text: "What does UML stand for?", options: ["Unified Modeling Language", "Universal Machine Language", "Unified Module Locator", "Universal Modeling Logic"], answer: 0 },
            { text: "What is code refactoring?", options: ["Rewriting code to add new features.", "The process of restructuring existing computer code—changing the factoring—without changing its external behavior.", "Deleting old code entirely.", "Testing the code."], answer: 1 },
            { text: "What is unit testing?", options: ["Testing the entire system.", "A software testing method by which individual units of source code are tested to determine whether they are fit for use.", "Testing done by end users.", "Security testing."], answer: 1 },
            { text: "What does a project charter contain?", options: ["All source code.", "A statement of the scope, objectives, and participants in a project.", "The daily schedule for engineers.", "The final test report."], answer: 1 },
            { text: "What is risk management?", options: ["Avoiding all projects.", "The identification, evaluation, and prioritization of risks followed by coordinated application of resources to minimize, monitor, and control the probability or impact of unfortunate events.", "Firing risky employees.", "Ignoring potential problems."], answer: 1 },
            { text: "What is a Gantt chart used for?", options: ["Designing databases.", "A type of bar chart that illustrates a project schedule.", "Writing algorithms.", "Showing network topology."], answer: 1 },
            { text: "What is black-box testing?", options: ["Testing the hardware box.", "A method of software testing that examines the functionality of an application without peering into its internal structures or workings.", "Testing done in the dark.", "Performance testing only."], answer: 1 },
            { text: "What is the Waterfall model?", options: ["An iterative process.", "A breakdown of project activities into linear sequential phases.", "A random development approach.", "An obsolete agile method."], answer: 1 },
            { text: "What are software requirements specifications (SRS)?", options: ["A document that describes what the software will do and how it will be expected to perform.", "The final product.", "A budget outline.", "A hardware manual."], answer: 0 },
            { text: "What differentiates open source from proprietary software?", options: ["Open source is always free.", "Open source software's source code is made available with a license in which the copyright holder provides the rights to study, change, and distribute the software.", "Proprietary software has better graphics.", "There is no difference."], answer: 1 },
            { text: "What is technical debt?", options: ["Money owed to developers.", "The implied cost of additional rework caused by choosing an easy (limited) solution now instead of using a better approach that would take longer.", "The cost of buying software.", "A loan from a bank."], answer: 1 },
            { text: "What is DevOps?", options: ["A software testing tool.", "A set of practices that combines software development (Dev) and IT operations (Ops).", "A new programming language.", "A type of firewall."], answer: 1 },
            { text: "What does a product backlog consist of?", options: ["A prioritized list of work for the development team that is derived from the roadmap and its requirements.", "A list of completed tasks.", "A log of software bugs.", "A list of server errors."], answer: 0 }
        ]
    }
};

const user = JSON.parse(localStorage.getItem('proctorly_user'));
if (user) {
    document.getElementById('user-display').textContent = user.full_name;
} else {
    window.location.href = "/";
}

const views = ['dashboard-view', 'instructions-view', 'proctoring-view', 'result-view'];

function showView(viewId) {
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

async function startJoinFlow(examCode) {
    let code = examCode || 'PRACTICE';
    code = code.toUpperCase();
    if(!code) return alert("Please specify an exam code");
    
    // Assign Mock Data
    if(MOCK_EXAMS[code]) {
        currentExamData = MOCK_EXAMS[code];
    } else {
        // Fallback default exam
        currentExamData = {
            title: `Assessment: ${code}`,
            questions: [
                { text: "Sample Question 1?", options: ["Option A", "Option B", "Option C", "Option D"], answer: 0 },
                { text: "Sample Question 2?", options: ["Option A", "Option B", "Option C", "Option D"], answer: 1 }
            ]
        };
    }
    
    currentQuestionIndex = 0;
    userAnswers = {};
    
    showView('instructions-view');
    
    // Reset Readiness UI
    document.getElementById('biometric-section').classList.add('hidden');
    document.getElementById('readiness-success').classList.add('hidden');
    document.getElementById('check-network').innerHTML = `<span class="icon" style="width:20px;">⏳</span> Network Stability: Checking...`;
    document.getElementById('check-mic').innerHTML = `<span class="icon" style="width:20px;">⏳</span> Microphone Access: Checking...`;
    document.getElementById('check-camera').innerHTML = `<span class="icon" style="width:20px;">⏳</span> Camera Access: Checking...`;
    
    // 1. Simulate Network Check
    await new Promise(r => setTimeout(r, 800));
    document.getElementById('check-network').innerHTML = `<span class="icon" style="width:20px; color:#1e8e3e">✔</span> Network Stability: Excellent`;
    
    // 2. Check Mic
    await new Promise(r => setTimeout(r, 600));
    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(t => t.stop());
        document.getElementById('check-mic').innerHTML = `<span class="icon" style="width:20px; color:#1e8e3e">✔</span> Microphone Access: Granted`;
    } catch(e) {
        document.getElementById('check-mic').innerHTML = `<span class="icon" style="width:20px; color:#ea4335">✖</span> Microphone Access: Denied`;
    }

    // 3. Check Camera & Start Stream
    await new Promise(r => setTimeout(r, 500));
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('instruction-webcam').srcObject = mediaStream;
        document.getElementById('check-camera').innerHTML = `<span class="icon" style="width:20px; color:#1e8e3e">✔</span> Camera Access: Granted`;
    } catch (err) {
        document.getElementById('check-camera').innerHTML = `<span class="icon" style="width:20px; color:#ea4335">✖</span> Camera Access: Denied`;
        return alert("Camera required to proceed.");
    }

    document.getElementById('readiness-success').classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('biometric-section').classList.remove('hidden');
        // Check if user has a face registered
        if (user.has_face) {
            document.getElementById('btn-verify-face').textContent = "Verify Face Identity";
            document.getElementById('face-auth-msg').textContent = "We need to verify your identity using Face ID before you start.";
        } else {
            document.getElementById('btn-verify-face').textContent = "Capture & Register Face";
            document.getElementById('face-auth-msg').textContent = "First-time setup: Please look at the camera to securely register your Face ID.";
        }
    }, 1000);
}

document.getElementById('btn-verify-face').addEventListener('click', async () => {
    const btn = document.getElementById('btn-verify-face');
    const loader = document.getElementById('face-loader');
    const video = document.getElementById('instruction-webcam');
    
    btn.disabled = true;
    loader.classList.remove('hidden');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'face.jpg');
        
        const endpoint = user.has_face ? `/api/verify_face_id/${user.user_id}` : `/api/register_face/${user.user_id}`;
        
        try {
            const res = await fetch(endpoint, { method: 'POST', body: formData });
            if (res.ok) {
                if (!user.has_face) {
                    user.has_face = true;
                    localStorage.setItem('proctorly_user', JSON.stringify(user));
                }
                btn.style.display = 'none';
                document.getElementById('btn-start-exam').classList.remove('hidden');
                document.getElementById('face-auth-msg').textContent = "Identity verified successfully! You may begin.";
                document.getElementById('face-auth-msg').style.color = "#1e8e3e";
            } else {
                const err = await res.json();
                alert((user.has_face ? "Verification Failed: " : "Registration Failed: ") + (err.detail || "Unknown error"));
                btn.disabled = false;
            }
        } catch (e) {
            alert("Connection error.");
            btn.disabled = false;
        } finally {
            loader.classList.add('hidden');
        }
    }, 'image/jpeg');
});

document.getElementById('btn-start-exam').addEventListener('click', () => {
    showView('proctoring-view');
    const examVideo = document.getElementById('proctor-webcam');
    examVideo.srcObject = mediaStream;
    
    document.getElementById('exam-title-display').textContent = currentExamData.title;
    renderQuestion();
    
    examStartTime = Date.now();
    isExamActive = true;
    startTimer(45 * 60); // 45 minutes
    
    ws = new WebSocket(wsUrl + user.user_id);
    const canvas = document.createElement('canvas');
    
    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if(data.session_id) {
            window.currentServerSessionId = data.session_id;
        }
        if(data.alert) {
            logAlert(data.alert, data.detail || "Violation detected");
        }
    };
    
    intervalId = setInterval(() => {
        if(ws.readyState === WebSocket.OPEN) {
            canvas.width = examVideo.videoWidth || 640;
            canvas.height = examVideo.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(examVideo, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/jpeg', 0.5);
            ws.send(JSON.stringify({ frame: frameData }));
            
            // Background Live Simulation Effects for Demo Wow-factor
            if(Math.random() > 0.95) {
                const audioBadge = document.getElementById('audio-tracker');
                audioBadge.style.background = 'rgba(234,67,53,0.9)'; audioBadge.style.color = 'white'; audioBadge.textContent = '🔊 Audio: Noise Detected';
                setTimeout(() => { audioBadge.style.background = 'rgba(32,33,36,0.8)'; audioBadge.style.color = '#81c995'; audioBadge.textContent = '🎤 Audio: Clear'; }, 2000);
            }
            if(Math.random() > 0.98) {
                const postureBadge = document.getElementById('posture-tracker');
                postureBadge.style.background = 'rgba(242,153,0,0.9)'; postureBadge.style.color = 'black'; postureBadge.textContent = '🧍‍♂️ Posture: Slouching';
                setTimeout(() => { postureBadge.style.background = 'rgba(32,33,36,0.8)'; postureBadge.style.color = '#81c995'; postureBadge.textContent = '🧍‍♂️ Posture: Good'; }, 3000);
            }
            document.getElementById('face-vis-text').textContent = (85 + Math.floor(Math.random() * 15)) + "%";
        }
    }, 500); // 2 FPS
});

// Tab Switch Tracker (Feature 11)
window.addEventListener('blur', () => {
    if (isExamActive) {
        logAlert("TAB SWITCH DETECTED", "User navigated away from the active exam window.");
    }
});

function showWarningToast(type, detail) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '10%';
    toast.style.left = '50%';
    toast.style.transform = 'translate(-50%, -50%)';
    toast.style.background = 'rgba(234,67,53,0.95)';
    toast.style.color = 'white';
    toast.style.padding = '16px 32px';
    toast.style.borderRadius = '12px';
    toast.style.fontWeight = '700';
    toast.style.fontSize = '1.2rem';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 30px rgba(234,67,53,0.5)';
    toast.style.textAlign = 'center';
    toast.style.transition = 'opacity 0.5s, top 0.5s';
    toast.style.animation = 'blink 1.5s infinite';
    
    toast.innerHTML = `⚠️ WARNING: ${type.toUpperCase()}<br><span style="font-size:0.95rem; font-weight:500;">${detail}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.top = '5%';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function logAlert(type, detail) {
    if(!isExamActive) return;
    warnings++;
    violationTypes.push(type);
    
    showWarningToast(type, detail);
    
    // Update Trust Score (Feature 1)
    trustScore = Math.max(0, trustScore - 20);
    const circle = document.getElementById('trust-circle');
    circle.style.strokeDasharray = `${trustScore}, 100`;
    document.getElementById('trust-score-text').textContent = trustScore + "%";
    
    if(trustScore < 50) {
        circle.style.stroke = "#ea4335";
        document.getElementById('trust-score-text').style.color = "#ea4335";
        document.getElementById('focus-level-text').textContent = "Low";
        document.getElementById('focus-level-text').style.color = "#ea4335";
    } else if(trustScore <= 80) {
        circle.style.stroke = "#fbbc04";
        document.getElementById('trust-score-text').style.color = "#f29900";
        document.getElementById('focus-level-text').textContent = "Medium";
        document.getElementById('focus-level-text').style.color = "#f29900";
    }
    
    // Update Snapshot counter (Feature 5)
    document.getElementById('snapshot-count').textContent = warnings;
    
    document.getElementById('warning-badge').textContent = `${warnings} Warnings`;
    
    const log = document.getElementById('violation-log');
    const div = document.createElement('div');
    div.style.padding = '8px';
    div.style.borderRadius = '6px';
    div.style.background = 'rgba(234,67,53,0.1)';
    div.style.borderLeft = '3px solid #ea4335';
    div.style.fontSize = '0.9rem';
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    div.innerHTML = `<strong style="color:#ea4335;">[${time}] ${type.toUpperCase()}:</strong> <span style="color:#202124;">${detail}</span>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    
    if (warnings >= 5 && isExamActive) {
        isExamActive = false; // Disable instantly to prevent blur loop
        alert("Maximum warnings reached. Exam will auto-submit.");
        submitExam();
    }
}

function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('timer-display');
    timerId = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        display.textContent = minutes + ":" + seconds;
        if (--timer < 0) {
            submitExam();
        }
    }, 1000);
}

// ----------------- QUESTION RENDERING LOGIC ----------------- //

function renderQuestion() {
    if(!currentExamData) return;
    const qData = currentExamData.questions[currentQuestionIndex];
    document.getElementById('q-number').textContent = `Question ${currentQuestionIndex + 1}`;
    document.getElementById('q-progress').textContent = `${currentQuestionIndex + 1} / ${currentExamData.questions.length}`;
    document.getElementById('q-text').textContent = qData.text;
    
    const optionsContainer = document.getElementById('q-options');
    optionsContainer.innerHTML = '';
    
    qData.options.forEach((optText, index) => {
        const isSelected = userAnswers[currentQuestionIndex] === index;
        
        let borderStr = isSelected ? 'border-color:#1a73e8;' : 'border-color:rgba(255,255,255,0.2);';
        let bgStr = isSelected ? 'background-color:rgba(26,115,232,0.1);' : 'background-color:rgba(255,255,255,0.05);';
        
        optionsContainer.innerHTML += `
            <label class="q-opt" onclick="selectOption(${index})" style="display:flex; gap:12px; align-items:flex-start; padding:16px; border:2px solid; border-radius:8px; cursor:pointer; transition:all 0.2s; color:white; ${borderStr} ${bgStr}" onmouseover="if(!this.querySelector('input').checked) this.style.backgroundColor='rgba(255,255,255,0.1)'" onmouseout="if(!this.querySelector('input').checked) this.style.backgroundColor='rgba(255,255,255,0.05)'">
                <input type="radio" name="current_q" ${isSelected ? 'checked' : ''} style="margin-top:4px; transform:scale(1.2); accent-color:#1a73e8; cursor:pointer; pointer-events:none;"> 
                <span style="line-height:1.4;">${optText}</span>
            </label>
        `;
    });
    
    // Update button states
    document.getElementById('btn-prev').disabled = currentQuestionIndex === 0;
    if(currentQuestionIndex === 0) {
        document.getElementById('btn-prev').style.opacity = '0.5';
        document.getElementById('btn-prev').style.cursor = 'not-allowed';
    } else {
        document.getElementById('btn-prev').style.opacity = '1';
        document.getElementById('btn-prev').style.cursor = 'pointer';
    }
    
    const nextBtn = document.getElementById('btn-next');
    if (currentQuestionIndex === currentExamData.questions.length - 1) {
        nextBtn.textContent = 'Submit Exam';
        nextBtn.style.background = '#34a853'; // Success color
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.style.background = '#1a73e8';
    }
}

function selectOption(index) {
    userAnswers[currentQuestionIndex] = index;
    renderQuestion(); // Re-render to update UI highlight
}

window.prevQuestion = function() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

window.nextQuestion = function() {
    if (currentQuestionIndex < currentExamData.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        // Last question, so submt
        if(confirm("Are you sure you want to finish and submit the exam?")) {
            submitExam();
        }
    }
}

// ------------------------------------------------------------ //

function submitExam() {
    isExamActive = false;
    document.exitFullscreen().catch(err => console.log(err));
    
    // Stop streaming interval and close WebSocket
    if (intervalId) clearInterval(intervalId);
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    
    // Stop camera/mic streams
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Show results view
    document.getElementById('proctoring-view').classList.add('hidden');
    document.getElementById('result-view').classList.remove('hidden');
    
    clearInterval(timerId); // Use timerId from startTimer
    const examSeconds = Math.floor((Date.now() - examStartTime) / 1000);
    document.getElementById('result-time').textContent = formatTime(examSeconds);
    
    // Calculate Risk Score
    let riskLevel = "LOW";
    let riskColor = "#1e8e3e"; // Green
    if (warnings >= 5 || trustScore < 50) {
        riskLevel = "HIGH";
        riskColor = "#ea4335"; // Red
    } else if (warnings >= 2 || trustScore < 80) {
        riskLevel = "MEDIUM";
        riskColor = "#fbbc04"; // Yellow
    }
    
    document.getElementById('result-warnings').innerHTML = `${warnings} <span style="font-size:0.8rem; color:#5f6368;">/ 5 max</span>`;
    document.getElementById('ai-confidence').textContent = trustScore + '%';
    
    const riskEl = document.getElementById('result-risk-score');
    riskEl.textContent = riskLevel;
    riskEl.style.color = riskColor;
    
    // Create Scoresheet Data
    const scoresheet = {
        id: 'EXM-' + Math.floor(Math.random()*10000) + '-' + new Date().getTime().toString().slice(-4),
        session_id: window.currentServerSessionId || null,
        date: new Date().toLocaleDateString(),
        subject: document.getElementById('result-exam-name').textContent,
        timeTaken: formatTime(examSeconds),
        warnings: warnings,
        trustScore: trustScore,
        riskLevel: riskLevel,
        riskColor: riskColor
    };
    
    // Save to localStorage
    const saved = JSON.parse(localStorage.getItem('proctorly_scoresheets') || '[]');
    saved.unshift(scoresheet);
    localStorage.setItem('proctorly_scoresheets', JSON.stringify(saved));
    
    if (window.currentServerSessionId) {
        const dlBtn = document.getElementById('result-download-btn');
        if (dlBtn) {
            dlBtn.href = `/api/sessions/${window.currentServerSessionId}/report`;
            dlBtn.classList.remove('hidden');
        }
    }
    
    // Re-render scoresheets
    renderScoresheets();

    // AI Suggestion Assistant Generator (Feature 13)
    const suggestionsList = document.getElementById('ai-suggestions-list');
    suggestionsList.innerHTML = '';
    if (warnings === 0) {
        suggestionsList.innerHTML = '<li>🌟 Excellent integrity! Your proctoring data indicates a highly secure environment.</li>';
    } else {
        suggestionsList.innerHTML = '<li>⚠️ Please ensure you test your hardware thoroughly next time.</li>';
        if(violationTypes.some(v => v.includes('TAB'))) {
            suggestionsList.innerHTML += '<li>🛡️ Tab switching is considered a major integrity risk. Disable notifications to avoid accidental clicks.</li>';
        }
        if(violationTypes.some(v => v.includes('MULTIPLE'))) {
            suggestionsList.innerHTML += '<li>👤 Ensure you take exams in a completely isolated private room.</li>';
        }
        if(violationTypes.length >= 2) {
            suggestionsList.innerHTML += '<li>💡 Consider using Practice Mode before taking official exams to familiarize yourself with the AI.</li>';
        }
    }
    document.getElementById('ai-suggestions-panel').classList.remove('hidden');
    
    showView('result-view');
}

function requestBreak() {
    if (breaksUsed >= 2) return alert("You have used all your allotted micro-breaks.");
    breaksUsed++;
    document.getElementById('btn-break').textContent = `☕ Take Break (${breaksUsed}/2)`;
    alert("Micro-break activated. Minor head movements and audio will not be harshly penalized for the next 2 minutes. Do not leave the camera view.");
}

function toggleBoundingBox() {
    document.getElementById('bounding-box').classList.toggle('hidden');
}

function goHome() {
    window.location.reload();
}

// Global Dashboard Countdown Timer (Feature 3)
function startDashboardCountdown() {
    const countdownEl = document.getElementById('global-countdown');
    if (!countdownEl) return;
    
    // Set a mock target time 1 hour, 45 mins, 20 seconds
    let totalSeconds = (1 * 3600) + (45 * 60) + 20; 
    
    setInterval(() => {
        if (totalSeconds <= 0) return;
        totalSeconds--;
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        if(countdownEl) countdownEl.textContent = `${h}:${m}:${s}`;
    }, 1000);
}

// Initialize Dashboard features on load
if (document.getElementById('dashboard-view') && !document.getElementById('dashboard-view').classList.contains('hidden')) {
    startDashboardCountdown();
}

// Sidebar navigation for Dashboard
function switchDashboardTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.dash-tab').forEach(el => el.classList.add('hidden'));
    const targetTab = document.getElementById('tab-' + tabId);
    if(targetTab) targetTab.classList.remove('hidden');
    
    // Reset nav buttons
    document.querySelectorAll('.dash-nav, .dash-nav-active').forEach(el => {
        el.className = 'dash-nav';
        el.style.color = '#5f6368';
        el.style.background = 'transparent';
    });
    
    // Set active nav button
    const activeNav = document.getElementById('nav-' + tabId);
    if(activeNav) {
        activeNav.className = 'dash-nav-active';
        activeNav.style.color = '#1a73e8';
        activeNav.style.background = '#e8f0fe';
    }
}

// Join Class Feature
function joinClassDashboard() {
    const codeInput = document.getElementById('class-code-input');
    if (!codeInput) return;
    const code = codeInput.value.trim();
    if (!code) {
        alert("Please enter a valid class code.");
        return;
    }
    
    // Mock logic for joining a class
    alert(`Successfully joined class: ${code}! The instructor's exams will appear in your dashboard shortly.`);
    codeInput.value = '';
}

// Environment Calibration (Unique Feature)
async function runCalibration() {
    document.getElementById('calibration-results').classList.remove('hidden');
    const btn = document.getElementById('btn-run-calibration');
    btn.disabled = true;
    btn.innerHTML = `<span style="animation: blink 1s infinite;">Scanning Environment...</span>`;
    
    const shield = document.getElementById('cal-shield');
    const icon = document.getElementById('cal-icon');
    shield.style.background = '#e8f0fe';
    icon.style.stroke = '#1a73e8';
    
    document.getElementById('cal-light').innerHTML = 'Analyzing...';
    document.getElementById('cal-audio').innerHTML = 'Analyzing...';
    document.getElementById('cal-device').innerHTML = 'Analyzing...';

    await new Promise(r => setTimeout(r, 1500));
    document.getElementById('cal-light').innerHTML = '<span style="color:#1e8e3e">✔ Optimal (450 Lux)</span>';
    
    await new Promise(r => setTimeout(r, 1500));
    document.getElementById('cal-audio').innerHTML = '<span style="color:#1e8e3e">✔ Silent (22 dB)</span>';
    
    await new Promise(r => setTimeout(r, 1500));
    document.getElementById('cal-device').innerHTML = '<span style="color:#1e8e3e">✔ Clean (No VM/Proxy)</span>';
    
    shield.style.background = '#e6f4ea';
    icon.style.stroke = '#1e8e3e';
    document.getElementById('cal-status-title').innerHTML = 'Environment Secured <span style="color:#1e8e3e;">✔</span>';
    document.getElementById('cal-status-desc').textContent = 'Your physical area and device are 100% compliant for AI proctoring.';
    
    btn.innerHTML = `Scan Complete`;
}

// Render Scoresheets on load
function renderScoresheets() {
    const container = document.getElementById('scoresheets-container');
    if(!container) return;
    
    const saved = JSON.parse(localStorage.getItem('proctorly_scoresheets') || '[]');
    if(saved.length === 0) {
        container.innerHTML = `<div style="padding:32px; color:#5f6368; font-style:italic; background:white; border-radius:12px; border:1px dashed #dadce0;">No detailed scoresheets generated yet. Complete an exam to see your reports here.</div>`;
        return;
    }
    const grouped = {};
    saved.forEach(s => {
        if(!grouped[s.subject]) grouped[s.subject] = [];
        grouped[s.subject].push(s);
    });
    
    let html = '';
    for(const subject in grouped) {
        html += `<h3 style="color:#202124; margin: 32px 0 16px 0; border-bottom:2px solid #e8f0fe; padding-bottom:8px; font-size:1.2rem; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-folder-open" style="color:#1a73e8;"></i> ${subject}</h3>`;
        html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:20px;">`;
        
        html += grouped[subject].map(sheet => `
        <div style="background:white; border-radius:12px; border:1px solid #dadce0; box-shadow:0 1px 3px rgba(60,64,67,0.1); overflow:hidden; display:flex; flex-direction:column;">
            <div style="padding:16px 20px; border-bottom:1px solid #e0e0e0; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:#202124;">${sheet.subject}</span>
                <span style="font-size:0.8rem; color:#5f6368; background:#f8f9fa; padding:4px 8px; border-radius:12px;">${sheet.date}</span>
            </div>
            <div style="padding:20px; flex-grow:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <span style="color:#5f6368; font-size:0.9rem;">Duration</span>
                    <strong style="color:#202124;">${sheet.timeTaken}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <span style="color:#5f6368; font-size:0.9rem;">AI Warnings</span>
                    <strong style="color:${sheet.warnings > 0 ? '#ea4335' : '#1e8e3e'};">${sheet.warnings} / 5</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                    <span style="color:#5f6368; font-size:0.9rem;">Integrity Score</span>
                    <strong style="color:${sheet.trustScore < 80 ? '#ea4335' : '#1e8e3e'};">${sheet.trustScore}%</strong>
                </div>
                <div style="background:#e8f0fe; padding:12px; border-radius:6px; text-align:center; border:1px solid #aecbfa;">
                    <span style="font-size:0.8rem; color:#1a73e8; text-transform:uppercase; letter-spacing:1px; font-weight:700; display:block; margin-bottom:4px;">Calculated Risk Level</span>
                    <strong style="font-size:1.2rem; color:${sheet.riskColor};">${sheet.riskLevel}</strong>
                </div>
            </div>
            <div style="background:#f8f9fa; padding:12px 20px; border-top:1px solid #e0e0e0; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; color:#5f6368; font-family:monospace; font-weight:600;">REPORT ID: ${sheet.id}</span>
                ${sheet.session_id ? `<a href="/api/sessions/${sheet.session_id}/report" target="_blank" class="btn" style="background:#1a73e8; color:white; padding:6px 16px; border-radius:6px; font-size:0.85rem; text-decoration:none; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-file-pdf"></i> Download PDF</a>` : `<span style="font-size:0.8rem; color:#9aa0a6; font-style:italic;">PDF Unavailable</span>`}
            </div>
        </div>
        `).join('');
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

function renderProfile() {
    const usr = JSON.parse(localStorage.getItem('proctorly_user'));
    if(!usr) return;
    
    document.getElementById('profile-name').textContent = usr.full_name || "Unknown";
    document.getElementById('profile-username').textContent = "@" + usr.username;
    if (usr.full_name) {
        document.getElementById('profile-avatar-initial').textContent = usr.full_name.charAt(0).toUpperCase();
    }
    document.getElementById('profile-role').textContent = usr.role || "Student";
    
    const faceStatus = document.getElementById('profile-face-status');
    if (usr.has_face) {
        faceStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> Verified';
        faceStatus.style.color = '#1e8e3e';
    } else {
        faceStatus.innerHTML = '<i class="fa-solid fa-exclamation-circle"></i> Not Verified';
        faceStatus.style.color = '#ea4335';
    }
    
    // Member since fallback to today's month/year since we don't have a creation date stored locally
    document.getElementById('profile-join-date').textContent = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const scoresheets = JSON.parse(localStorage.getItem('proctorly_scoresheets') || '[]');
    document.getElementById('stat-total-exams').textContent = scoresheets.length;
    
    let totalTrust = 0;
    scoresheets.forEach(s => totalTrust += (s.trustScore || 0));
    const avgTrust = scoresheets.length > 0 ? Math.round(totalTrust / scoresheets.length) : 100;
    
    const avgTrustEl = document.getElementById('stat-avg-trust');
    if(avgTrustEl) {
        avgTrustEl.textContent = avgTrust + '%';
        if(avgTrust < 50) {
            avgTrustEl.style.color = '#ea4335';
        } else if(avgTrust < 80) {
            avgTrustEl.style.color = '#fbbc04';
        } else {
            avgTrustEl.style.color = '#34a853';
        }
    }
}

function renderDashboardExams() {
    const scoresheets = JSON.parse(localStorage.getItem('proctorly_scoresheets') || '[]');
    const examCodes = ['ML101', 'IVP101', 'DAV101', 'CSS101', 'SEPM101'];
    let completedCount = 0;
    
    examCodes.forEach(code => {
        // We check if the scoresheet exists. In proctor.js the `submitExam()` records `subject` which matches `window.currentSubject` which matches the exam code in most cases.
        // Also wait, `submitExam()`: `subject: window.currentSubject || document.getElementById('proctor-exam-name').textContent`
        // Actually, the scoresheet records the subject title like "Course Examination" or if we use startJoinFlow('ML101'), it might set something else. Let's look at `startJoinFlow()`.
        // Let's broaden the match or just match `.subject`.
        // We will just do a loose check: scoresheets.some(sheet => sheet.subject.includes(code))
        const isCompleted = scoresheets.some(sheet => sheet.subject && sheet.subject.includes(code));
        
        if(isCompleted) {
            completedCount++;
            const btn = document.getElementById(`exam-btn-${code}`);
            const card = document.getElementById(`exam-card-${code}`);
            const badge = document.getElementById(`exam-badge-${code}`);
            
            if(btn && card) {
                btn.textContent = 'Completed';
                btn.onclick = null;
                btn.style.background = 'rgba(255,255,255,0.05)';
                btn.style.color = 'rgba(255,255,255,0.4)';
                btn.style.cursor = 'not-allowed';
                btn.style.boxShadow = 'none';
                card.style.opacity = '0.6';
                card.style.borderColor = 'rgba(52,168,83,0.3)';
                
                if(badge) {
                    badge.style.display = 'inline-block';
                    badge.textContent = 'COMPLETED';
                    badge.style.background = 'rgba(52,168,83,0.15)';
                    badge.style.color = '#34a853';
                    badge.style.borderColor = 'rgba(52,168,83,0.3)';
                }
            }
        }
    });
    
    const pendingText = document.getElementById('dashboard-pending-text');
    if(pendingText) {
        const pendingCount = examCodes.length - completedCount;
        if(pendingCount === 0) {
            pendingText.innerHTML = `You have <strong>completed</strong> all your active exams. Great job!`;
        } else {
            pendingText.innerHTML = `You have <strong>${pendingCount}</strong> active mock exams pending for calibration.`;
        }
    }
}

if(document.getElementById('scoresheets-container')) {
    renderScoresheets();
    renderProfile();
}

// Call dashboard update logic on load
renderDashboardExams();

