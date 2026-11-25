<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApiResetPasswordNotification extends Notification
{
    use Queueable;

    protected string $token;

    public function __construct(string $token)
    {
        $this->token = $token;
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $email = urlencode(
            $notifiable->getEmailForPasswordReset()
        );

        $resetUrl = url(
            '/reset-password/'.$this->token
            .'?email='.$email
        );

        return (new MailMessage)
            ->subject('Reset Your Password')
            ->greeting('Hello!')
            ->line(
                'You requested a password reset for your account.'
            )
            ->action('Reset Password', $resetUrl)
            ->line(
                'If you did not request a password reset, no further action is required.'
            );
    }
}
