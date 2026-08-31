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
