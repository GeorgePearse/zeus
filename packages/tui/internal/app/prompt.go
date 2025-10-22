package app

import (
	"errors"
	"time"

	"github.com/sst/zeus-sdk-go"
	"github.com/sst/zeus/internal/attachment"
	"github.com/sst/zeus/internal/id"
)

type Prompt struct {
	Text        string                   `toml:"text"`
	Attachments []*attachment.Attachment `toml:"attachments"`
}

func (p Prompt) ToMessage(
	messageID string,
	sessionID string,
) Message {
	message := zeus.UserMessage{
		ID:        messageID,
		SessionID: sessionID,
		Role:      zeus.UserMessageRoleUser,
		Time: zeus.UserMessageTime{
			Created: float64(time.Now().UnixMilli()),
		},
	}

	text := p.Text
	textAttachments := []*attachment.Attachment{}
	for _, attachment := range p.Attachments {
		if attachment.Type == "text" {
			textAttachments = append(textAttachments, attachment)
		}
	}
	for i := 0; i < len(textAttachments)-1; i++ {
		for j := i + 1; j < len(textAttachments); j++ {
			if textAttachments[i].StartIndex < textAttachments[j].StartIndex {
				textAttachments[i], textAttachments[j] = textAttachments[j], textAttachments[i]
			}
		}
	}
	for _, att := range textAttachments {
		if source, ok := att.GetTextSource(); ok {
			if att.StartIndex > att.EndIndex || att.EndIndex > len(text) {
				continue
			}
			text = text[:att.StartIndex] + source.Value + text[att.EndIndex:]
		}
	}

	parts := []zeus.PartUnion{zeus.TextPart{
		ID:        id.Ascending(id.Part),
		MessageID: messageID,
		SessionID: sessionID,
		Type:      zeus.TextPartTypeText,
		Text:      text,
	}}
	for _, attachment := range p.Attachments {
		if attachment.Type == "agent" {
			source, _ := attachment.GetAgentSource()
			parts = append(parts, zeus.AgentPart{
				ID:        id.Ascending(id.Part),
				MessageID: messageID,
				SessionID: sessionID,
				Name:      source.Name,
				Source: zeus.AgentPartSource{
					Value: attachment.Display,
					Start: int64(attachment.StartIndex),
					End:   int64(attachment.EndIndex),
				},
			})
			continue
		}

		text := zeus.FilePartSourceText{
			Start: int64(attachment.StartIndex),
			End:   int64(attachment.EndIndex),
			Value: attachment.Display,
		}
		source := &zeus.FilePartSource{}
		switch attachment.Type {
		case "text":
			continue
		case "file":
			if fileSource, ok := attachment.GetFileSource(); ok {
				source = &zeus.FilePartSource{
					Text: text,
					Path: fileSource.Path,
					Type: zeus.FilePartSourceTypeFile,
				}
			}
		case "symbol":
			if symbolSource, ok := attachment.GetSymbolSource(); ok {
				source = &zeus.FilePartSource{
					Text: text,
					Path: symbolSource.Path,
					Type: zeus.FilePartSourceTypeSymbol,
					Kind: int64(symbolSource.Kind),
					Name: symbolSource.Name,
					Range: zeus.SymbolSourceRange{
						Start: zeus.SymbolSourceRangeStart{
							Line:      float64(symbolSource.Range.Start.Line),
							Character: float64(symbolSource.Range.Start.Char),
						},
						End: zeus.SymbolSourceRangeEnd{
							Line:      float64(symbolSource.Range.End.Line),
							Character: float64(symbolSource.Range.End.Char),
						},
					},
				}
			}
		}
		parts = append(parts, zeus.FilePart{
			ID:        id.Ascending(id.Part),
			MessageID: messageID,
			SessionID: sessionID,
			Type:      zeus.FilePartTypeFile,
			Filename:  attachment.Filename,
			Mime:      attachment.MediaType,
			URL:       attachment.URL,
			Source:    *source,
		})
	}
	return Message{
		Info:  message,
		Parts: parts,
	}
}

func (m Message) ToPrompt() (*Prompt, error) {
	switch m.Info.(type) {
	case zeus.UserMessage:
		text := ""
		attachments := []*attachment.Attachment{}
		for _, part := range m.Parts {
			switch p := part.(type) {
			case zeus.TextPart:
				if p.Synthetic {
					continue
				}
				text += p.Text + " "
			case zeus.AgentPart:
				attachments = append(attachments, &attachment.Attachment{
					ID:         p.ID,
					Type:       "agent",
					Display:    p.Source.Value,
					StartIndex: int(p.Source.Start),
					EndIndex:   int(p.Source.End),
					Source: &attachment.AgentSource{
						Name: p.Name,
					},
				})
			case zeus.FilePart:
				switch p.Source.Type {
				case "file":
					attachments = append(attachments, &attachment.Attachment{
						ID:         p.ID,
						Type:       "file",
						Display:    p.Source.Text.Value,
						URL:        p.URL,
						Filename:   p.Filename,
						MediaType:  p.Mime,
						StartIndex: int(p.Source.Text.Start),
						EndIndex:   int(p.Source.Text.End),
						Source: &attachment.FileSource{
							Path: p.Source.Path,
							Mime: p.Mime,
						},
					})
				case "symbol":
					r := p.Source.Range.(zeus.SymbolSourceRange)
					attachments = append(attachments, &attachment.Attachment{
						ID:         p.ID,
						Type:       "symbol",
						Display:    p.Source.Text.Value,
						URL:        p.URL,
						Filename:   p.Filename,
						MediaType:  p.Mime,
						StartIndex: int(p.Source.Text.Start),
						EndIndex:   int(p.Source.Text.End),
						Source: &attachment.SymbolSource{
							Path: p.Source.Path,
							Name: p.Source.Name,
							Kind: int(p.Source.Kind),
							Range: attachment.SymbolRange{
								Start: attachment.Position{
									Line: int(r.Start.Line),
									Char: int(r.Start.Character),
								},
								End: attachment.Position{
									Line: int(r.End.Line),
									Char: int(r.End.Character),
								},
							},
						},
					})
				}
			}
		}
		return &Prompt{
			Text:        text,
			Attachments: attachments,
		}, nil
	}
	return nil, errors.New("unknown message type")
}

func (m Message) ToSessionChatParams() []zeus.SessionPromptParamsPartUnion {
	parts := []zeus.SessionPromptParamsPartUnion{}
	for _, part := range m.Parts {
		switch p := part.(type) {
		case zeus.TextPart:
			parts = append(parts, zeus.TextPartInputParam{
				ID:        zeus.F(p.ID),
				Type:      zeus.F(zeus.TextPartInputTypeText),
				Text:      zeus.F(p.Text),
				Synthetic: zeus.F(p.Synthetic),
				Time: zeus.F(zeus.TextPartInputTimeParam{
					Start: zeus.F(p.Time.Start),
					End:   zeus.F(p.Time.End),
				}),
			})
		case zeus.FilePart:
			var source zeus.FilePartSourceUnionParam
			switch p.Source.Type {
			case "file":
				source = zeus.FileSourceParam{
					Type: zeus.F(zeus.FileSourceTypeFile),
					Path: zeus.F(p.Source.Path),
					Text: zeus.F(zeus.FilePartSourceTextParam{
						Start: zeus.F(int64(p.Source.Text.Start)),
						End:   zeus.F(int64(p.Source.Text.End)),
						Value: zeus.F(p.Source.Text.Value),
					}),
				}
			case "symbol":
				source = zeus.SymbolSourceParam{
					Type: zeus.F(zeus.SymbolSourceTypeSymbol),
					Path: zeus.F(p.Source.Path),
					Name: zeus.F(p.Source.Name),
					Kind: zeus.F(p.Source.Kind),
					Range: zeus.F(zeus.SymbolSourceRangeParam{
						Start: zeus.F(zeus.SymbolSourceRangeStartParam{
							Line:      zeus.F(float64(p.Source.Range.(zeus.SymbolSourceRange).Start.Line)),
							Character: zeus.F(float64(p.Source.Range.(zeus.SymbolSourceRange).Start.Character)),
						}),
						End: zeus.F(zeus.SymbolSourceRangeEndParam{
							Line:      zeus.F(float64(p.Source.Range.(zeus.SymbolSourceRange).End.Line)),
							Character: zeus.F(float64(p.Source.Range.(zeus.SymbolSourceRange).End.Character)),
						}),
					}),
					Text: zeus.F(zeus.FilePartSourceTextParam{
						Value: zeus.F(p.Source.Text.Value),
						Start: zeus.F(p.Source.Text.Start),
						End:   zeus.F(p.Source.Text.End),
					}),
				}
			}
			parts = append(parts, zeus.FilePartInputParam{
				ID:       zeus.F(p.ID),
				Type:     zeus.F(zeus.FilePartInputTypeFile),
				Mime:     zeus.F(p.Mime),
				URL:      zeus.F(p.URL),
				Filename: zeus.F(p.Filename),
				Source:   zeus.F(source),
			})
		case zeus.AgentPart:
			parts = append(parts, zeus.AgentPartInputParam{
				ID:   zeus.F(p.ID),
				Type: zeus.F(zeus.AgentPartInputTypeAgent),
				Name: zeus.F(p.Name),
				Source: zeus.F(zeus.AgentPartInputSourceParam{
					Value: zeus.F(p.Source.Value),
					Start: zeus.F(p.Source.Start),
					End:   zeus.F(p.Source.End),
				}),
			})
		}
	}
	return parts
}
