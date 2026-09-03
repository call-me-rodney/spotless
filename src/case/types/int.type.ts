// Minimal shape of a multer disk-storage file. Declared locally because
// @types/multer is not installed, so the global Express.Multer namespace
// does not exist in this project.
export interface UploadedImage {
    fieldname: string;
    originalname: string;
    mimetype: string;
    size: number;
    filename: string;
    path: string;
}

// What the waste classifier said about a case image.
export interface ClassificationVerdict {
    // The winning label exactly as the model reported it.
    label: string;
    // Its confidence, 0..1.
    score: number;
    // Whether `label` was read as "waste is present". This decides the case.
    wastePresent: boolean;
}
