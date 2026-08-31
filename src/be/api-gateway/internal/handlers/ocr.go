package handlers

import (
	"io"
	"log"
	"net/http"
	"regexp"

	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"google.golang.org/genai"
)

// HandleOCRKTP processes multipart KTP image and extracts data using Gemini API.
func HandleOCRKTP(w http.ResponseWriter, req *http.Request) {
	err := req.ParseMultipartForm(10 << 20)
	if err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to parse form: " + err.Error()})
		return
	}

	file, fileHeader, err := req.FormFile("ktp")
	if err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to get KTP image: " + err.Error()})
		return
	}
	defer file.Close()

	imgData, err := io.ReadAll(file)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to read KTP image: " + err.Error()})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		if len(imgData) > 3 && imgData[0] == 0x89 && imgData[1] == 0x50 {
			mimeType = "image/png"
		} else if len(imgData) > 2 && imgData[0] == 0xFF && imgData[1] == 0xD8 {
			mimeType = "image/jpeg"
		} else {
			mimeType = "image/jpeg"
		}
	}
	log.Printf("OCR-KTP: received file '%s', size=%d bytes, mimeType=%s", fileHeader.Filename, len(imgData), mimeType)

	ctx := req.Context()
	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		log.Printf("ERROR OCR-KTP: failed to create GenAI client: %v", err)
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to create GenAI client: " + err.Error()})
		return
	}

	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{
				genai.NewPartFromText("You are an expert OCR system for Indonesian Identity Cards (KTP). Extract the following fields from the KTP image: NIK (16-digit number), Name (Nama), Date of Birth in YYYY-MM-DD format (Tanggal Lahir), Gender as exactly 'Laki-laki' or 'Perempuan' (Jenis Kelamin), and full Address (Alamat). Return ONLY a valid JSON object with keys: nik, name, dob, gender, address. No markdown, no explanation."),
			},
		},
		ResponseMIMEType: "application/json",
	}

	dbConn, dbErr := db.ConnectPostgres("")
	var modelName string
	if dbErr == nil {
		defer dbConn.Close()
		err = dbConn.QueryRowContext(ctx, "SELECT value FROM auth.system_settings WHERE key = $1", "gemini_ocr_model").Scan(&modelName)
	} else {
		err = dbErr
	}
	if err != nil || modelName == "" {
		log.Printf("OCR-KTP: failed to get model from DB, falling back to gemini-3.6-flash: %v", err)
		modelName = "gemini-3.6-flash"
	}

	log.Printf("OCR-KTP: calling Gemini API (model=%s)...", modelName)
	res, err := client.Models.GenerateContent(ctx, modelName, []*genai.Content{
		{
			Parts: []*genai.Part{
				genai.NewPartFromBytes(imgData, mimeType),
				genai.NewPartFromText("Please extract all KTP data fields from this image and return as JSON."),
			},
		},
	}, config)
	if err != nil {
		log.Printf("ERROR OCR-KTP: GenAI call failed: %v", err)
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to process KTP: " + err.Error()})
		return
	}

	log.Printf("OCR-KTP: Gemini responded, candidates=%d", len(res.Candidates))

	var extractedData map[string]string
	if len(res.Candidates) == 0 {
		log.Printf("ERROR OCR-KTP: Gemini returned 0 candidates")
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini returned empty response"})
		return
	}

	candidate := res.Candidates[0]
	if candidate.Content == nil || len(candidate.Content.Parts) == 0 {
		log.Printf("ERROR OCR-KTP: Gemini candidate has no content, FinishReason=%v", candidate.FinishReason)
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini returned no content"})
		return
	}

	rawText := candidate.Content.Parts[0].Text
	log.Printf("OCR-KTP: Gemini raw response text: %s", rawText)

	if rawText == "" {
		log.Printf("ERROR OCR-KTP: Gemini returned empty text")
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini returned empty text"})
		return
	}

	fieldRe := regexp.MustCompile(`"(\w+)"\s*:\s*"([^"]*)"`)
	matches := fieldRe.FindAllStringSubmatch(rawText, -1)
	if len(matches) == 0 {
		log.Printf("ERROR OCR-KTP: No key:value pairs found in response | raw: %s", rawText)
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini response contained no extractable data"})
		return
	}
	extractedData = make(map[string]string)
	for _, m := range matches {
		extractedData[m[1]] = m[2]
	}
	log.Printf("OCR-KTP: Extracted %d fields: %+v", len(extractedData), extractedData)

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data:    extractedData,
	})
}
